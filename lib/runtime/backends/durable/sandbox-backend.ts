import "server-only";

import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { defineDoc } from "@earendil-works/pi-durable";
import type {
  RuntimeArtifact,
  RuntimeBackend,
  RuntimeSession,
  RuntimeSpec,
} from "../../protocol";
import type {
  SandboxHandle,
  SandboxProvider,
  SandboxSpec,
} from "../../sandbox";
import { LazySandbox } from "../../sandbox/lazy";
import { startSandboxRenewalLoop } from "../../sandbox/leasing";
import {
  createSandboxTools,
  type SandboxArtifactInput,
} from "../sandbox-tools/tools";
import { DurableBackend, type DurableBackendOptions } from "./backend";

/** Host-owned mapping, committed before the first sandbox command. Never placed
 * in the model-writable workspace. No PID/TTL-based lock stealing or auto-resume.
 */
export const DurableSandboxExecutionDoc = defineDoc<{
  runId: string;
  provider: string;
  sandboxId?: string;
  stopped?: boolean;
}>({
  fork: "initial",
  history: "latest",
  initial: () => ({ provider: "", runId: "" }),
  kind: "piwork.sandbox-execution",
  scope: "conversation",
  version: 1,
});

export type DurableSandboxBackendOptions = {
  provider: SandboxProvider;
  storageFactory: NonNullable<DurableBackendOptions["storageFactory"]>;
  authorize: NonNullable<DurableBackendOptions["authorize"]>;
  authorizeTool: (
    spec: RuntimeSpec,
    callId: string,
    toolName: string
  ) => Promise<void>;
  sandboxSpec: (spec: RuntimeSpec, runId: string) => Promise<SandboxSpec>;
  /** Authorized reference hydration through bounded atomic filesystem only. */
  hydrateSandbox?: (
    spec: RuntimeSpec,
    handle: SandboxHandle,
    signal: AbortSignal
  ) => Promise<void>;
  /** Explicit non-production OpenSandbox contract probe, not a rollout switch. */
  experimentalOpenSandbox?: boolean;
  /** Platform-bound private persistence + archive before resolving. */
  publishArtifact?: (
    spec: RuntimeSpec,
    input: SandboxArtifactInput
  ) => Promise<RuntimeArtifact>;
};

/** Experimental composition: one official Durable Harness on private owned
 * SQLite, one lazy execution-only sandbox. Not SandboxRpc wrapped by a second
 * agent loop. No host execution env, discovered tools/extensions or MCP.
 *
 * Fresh runs only: reopening this execution requires Worker reconciliation,
 * workspace persistence and snapshot projection, none of which this adapter
 * pretends to provide. Production and automatic recovery remain fail-closed.
 */
export class DurableSandboxBackend implements RuntimeBackend {
  private readonly options: DurableSandboxBackendOptions;

  constructor(options: DurableSandboxBackendOptions) {
    this.options = options;
  }

  async open(spec: RuntimeSpec): Promise<RuntimeSession> {
    if (process.env.NODE_ENV === "production") {
      throw new Error("runtime:durable-sandbox:production-not-integrated");
    }
    if (
      this.options.provider.name === "opensandbox" &&
      !this.options.experimentalOpenSandbox
    ) {
      throw new Error("runtime:durable-sandbox:opensandbox-not-verified");
    }
    if (!spec.runId || !spec.workspaceDir) {
      throw new Error("runtime:durable-sandbox:owned-workspace-run-required");
    }
    if (spec.tools.length > 0) {
      throw new Error("runtime:durable-sandbox:platform-tools-not-approved");
    }
    const { options } = this;
    const { publishArtifact } = options;
    return await new DurableBackend({
      authorize: options.authorize,
      executionFactory: async (request, { harness, conversation, emit }) => {
        const { runId } = request;
        if (!runId) {
          throw new Error(
            "runtime:durable-sandbox:owned-workspace-run-required"
          );
        }
        const previous = await harness.snapshot(
          DurableSandboxExecutionDoc,
          conversation.id,
          BACKGROUND_CONTEXT
        );
        const history = await conversation.context(BACKGROUND_CONTEXT);
        if (previous || history.entries.length > 0) {
          throw new Error(
            "runtime:durable-sandbox:needs-review:recovery-not-integrated"
          );
        }
        const allocation = await options.sandboxSpec(request, runId);
        if (
          allocation.runId !== runId ||
          allocation.chatId !== request.chatId ||
          allocation.workspaceVolume.source !== request.workspaceDir ||
          allocation.egress.mode !== "deny-all"
        ) {
          throw new Error("runtime:durable-sandbox:invalid-allocation");
        }
        await conversation.commit(async (tx) => {
          const doc = await tx.doc(DurableSandboxExecutionDoc, conversation.id);
          doc.runId = runId;
          doc.provider = options.provider.name;
        }, BACKGROUND_CONTEXT);

        const hydration = new AbortController();
        let handle: SandboxHandle | undefined;
        let stopRenewal: (() => void) | undefined;
        const tracked: SandboxProvider = {
          acquire: async (sandboxRequest) => {
            // Recheck current grants at the provision boundary as well as execute.
            await options.authorize(request);
            handle = await options.provider.acquire(sandboxRequest);
            try {
              await conversation.commit(async (tx) => {
                (
                  await tx.doc(DurableSandboxExecutionDoc, conversation.id)
                ).sandboxId = handle?.id;
              }, BACKGROUND_CONTEXT);
              stopRenewal = startSandboxRenewalLoop(
                handle,
                sandboxRequest.ttlSeconds
              );
              await options.hydrateSandbox?.(request, handle, hydration.signal);
              hydration.signal.throwIfAborted();
              return handle;
            } catch (error) {
              // LazySandbox has not yet received the handle; we own this cleanup.
              await options.provider.release(handle, "kill");
              throw error;
            }
          },
          attach: () =>
            Promise.reject(
              new Error("runtime:durable-sandbox:attach-not-approved")
            ),
          name: options.provider.name,
          release: (resource, policy) =>
            options.provider.release(resource, policy),
        };
        const lazy = new LazySandbox(tracked, allocation, {
          signal: hydration.signal,
        });
        const bundle = createSandboxTools({
          authorize: (id, name) => options.authorizeTool(request, id, name),
          lazy,
          runId,
          ...(publishArtifact
            ? {
                onArtifact: (file: RuntimeArtifact) =>
                  emit({ file, type: "artifact.created" }),
                publishArtifact: (input: SandboxArtifactInput) =>
                  publishArtifact(request, input),
              }
            : {}),
        });
        let closing: Promise<void> | undefined;
        return {
          close: () => {
            closing ??= (async () => {
              hydration.abort(new Error("durable sandbox execution closed"));
              stopRenewal?.();
              await bundle.close();
              if (handle && (await handle.status()) !== "destroyed") {
                throw new Error(
                  "runtime:durable-sandbox:termination-unconfirmed"
                );
              }
              await conversation.commit(async (tx) => {
                (
                  await tx.doc(DurableSandboxExecutionDoc, conversation.id)
                ).stopped = true;
              }, BACKGROUND_CONTEXT);
            })();
            closing.catch(() => undefined);
            return closing;
          },
          tools: bundle.tools,
        };
      },
      storageFactory: options.storageFactory,
    }).open(spec);
  }
}
