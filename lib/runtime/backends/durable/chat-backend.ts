import "server-only";

import type { StoredFile } from "@/lib/ai/file-store";
import { createPrivateFileStore } from "@/lib/ai/private-file-store";
import type {
  RuntimeBackend,
  RuntimeSession,
  RuntimeSpec,
} from "../../protocol";
import type { SandboxProvider } from "../../sandbox";
import type { DurableChatFiles } from "./chat-attachments";
import { hashDurableChatInput, hashDurablePrompt, sha256 } from "./chat-input";
import { assertDurableChatUser, type DurableChatConfig } from "./chat-policy";
import { DurableSandboxBackend } from "./sandbox-backend";
import { openOwnedDurableStorage } from "./storage";

export type DurableChatServices = {
  config: () => DurableChatConfig | null;
  authorizeRun: (
    userId: string,
    chatId: string,
    runId: string
  ) => Promise<boolean>;
  modelEnabled: (catalogModelId: string) => Promise<boolean>;
  files: DurableChatFiles;
  archive: (userId: string, file: StoredFile, size: number) => Promise<unknown>;
};

/** Formal server bindings for a non-production fresh-run chat probe. No public
 * artifact store and no attachment bytes/closures enter RuntimeSpec.
 */
export class DurableChatBackend implements RuntimeBackend {
  private readonly provider: SandboxProvider;
  private readonly services: DurableChatServices;

  constructor(provider: SandboxProvider, services: DurableChatServices) {
    this.provider = provider;
    this.services = services;
  }

  async open(spec: RuntimeSpec): Promise<RuntimeSession> {
    const config = this.services.config();
    const grant = spec.durableChat;
    if (
      !config ||
      !grant ||
      spec.lane !== "durable_sandbox" ||
      !spec.runId ||
      spec.workspaceDir !== "ephemeral" ||
      !/^[a-f0-9]{64}$/.test(grant.promptHash)
    ) {
      throw new Error("runtime:durable-chat:invalid-server-grant");
    }
    if (
      this.provider.name !== config.provider &&
      this.provider.name !== "test"
    ) {
      throw new Error("runtime:durable-chat:provider-mismatch");
    }
    const inputHash = hashDurableChatInput(spec, config);
    const authorize = async (request: RuntimeSpec) => {
      const current = this.services.config();
      assertDurableChatUser(current, grant.userId);
      if (
        !current ||
        hashDurableChatInput(request, current) !== inputHash ||
        current.filesRoot !== config.filesRoot ||
        current.storageRoot !== config.storageRoot ||
        !request.runId ||
        !(await this.services.authorizeRun(
          grant.userId,
          request.chatId,
          request.runId
        )) ||
        !(await this.services.modelEnabled(grant.catalogModelId))
      ) {
        throw new Error("runtime:durable-chat:grant-revoked-or-changed");
      }
    };
    const savePrivate = createPrivateFileStore(config.filesRoot);
    const session = await new DurableSandboxBackend({
      authorize,
      authorizeTool: (request, _id, name) => {
        if (!["read", "write", "edit", "bash", "deliver_file"].includes(name)) {
          return Promise.reject(
            new Error("runtime:durable-chat:unapproved-tool")
          );
        }
        return authorize(request);
      },
      experimentalOpenSandbox: true,
      hydrateSandbox: async (request, handle, signal) => {
        if (!handle.filesystem) {
          throw new Error("runtime:durable-chat:bounded-filesystem-required");
        }
        let total = 0;
        for (const file of grant.attachments) {
          // biome-ignore lint/performance/noAwaitInLoops: current authorization before each bounded hydration
          await authorize(request);
          if (
            !/^inputs\/\d+-[a-zA-Z0-9._-]{1,150}$/.test(file.path) ||
            !Number.isSafeInteger(file.size) ||
            file.size < 0 ||
            file.size > 20 * 1024 * 1024
          ) {
            throw new Error(
              "runtime:durable-chat:invalid-attachment-reference"
            );
          }
          total += file.size;
          if (total > 50 * 1024 * 1024) {
            throw new Error("runtime:durable-chat:attachment-total-limit");
          }
          // Ownership checked at use, not just request admission.
          const item = await this.services.files.byId(
            grant.userId,
            file.libraryItemId
          );
          if (!item?.url || item.kind !== "file") {
            throw new Error("runtime:durable-chat:attachment-revoked");
          }
          // No unbounded/parallel downloads.
          const content = await this.services.files.read(
            item.url,
            20 * 1024 * 1024,
            signal
          );
          if (content.length !== file.size || sha256(content) !== file.sha256) {
            throw new Error("runtime:durable-chat:attachment-version-changed");
          }
          signal.throwIfAborted();
          // Atomic write is serialized before any model command.
          await handle.filesystem.writeAtomic({
            content,
            expectedSha256: null,
            maxBytes: 20 * 1024 * 1024,
            path: `${handle.workspaceRoot}/${file.path}`,
            signal,
          });
        }
      },
      provider: this.provider,
      publishArtifact: async (request, input) => {
        await authorize(request);
        if (
          input.runId !== request.runId ||
          sha256(input.content) !== input.sha256
        ) {
          throw new Error("runtime:durable-chat:artifact-binding-mismatch");
        }
        input.signal?.throwIfAborted();
        const file = await savePrivate({
          content: input.content,
          contentType: input.contentType,
          filename: input.filename,
          operationKey: JSON.stringify([
            grant.userId,
            request.chatId,
            input.runId,
            input.toolCallId,
          ]),
        });
        await authorize(request);
        await this.services.archive(grant.userId, file, input.content.length);
        await authorize(request);
        input.signal?.throwIfAborted();
        return {
          contentType: file.contentType,
          downloadUrl: file.downloadUrl,
          filename: file.name,
          url: file.url,
        };
      },
      sandboxSpec: async (request, runId) => ({
        chatId: request.chatId,
        egress: { mode: "deny-all" },
        image: config.image,
        resource: { cpuCores: 1, memoryMB: 512 },
        runId,
        ttlSeconds: 600,
        userId: grant.userId,
        workspaceVolume: { source: "ephemeral" },
      }),
      storageFactory: (request) =>
        openOwnedDurableStorage(config.storageRoot, {
          chatId: request.chatId,
          inputHash,
          runId: request.runId ?? "",
          userId: grant.userId,
        }),
    }).open(spec);
    return {
      close: (reason) => session.close(reason),
      events: (cursor) => session.events(cursor),
      send: async (command) => {
        if (command.type === "prompt") {
          if (hashDurablePrompt(command) !== grant.promptHash) {
            return {
              error: "runtime:durable-chat:prompt-binding-mismatch",
              ok: false,
            };
          }
          try {
            await authorize(spec);
          } catch {
            return {
              error: "runtime:durable-chat:grant-revoked-or-changed",
              ok: false,
            };
          }
        }
        return session.send(command);
      },
      snapshot: () => session.snapshot(),
    };
  }
}
