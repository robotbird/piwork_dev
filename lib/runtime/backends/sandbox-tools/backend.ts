import "server-only";

import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { createPiworkAgentSession } from "@/lib/ai/agent-session";
import { MANAGED_AGENT_DIR } from "@/lib/pi-packages/agent-dir";
import type {
  RuntimeArtifact,
  RuntimeBackend,
  RuntimeEvent,
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
import { sandboxCleanupFailure } from "../../sandbox/operation-error";
import { AsyncEventQueue } from "../event-queue";
import { InProcessRuntimeSession } from "../in-process/backend";
import { createSandboxTools, type SandboxArtifactInput } from "./tools";

const RESERVED_TOOLS = new Set([
  "read",
  "write",
  "edit",
  "bash",
  "deliver_file",
]);

function validateImages(images: readonly { data: string; mimeType: string }[]) {
  let bytes = 0;
  if (images.length > 5) {
    throw new Error("runtime:sandbox-tools:image-count-limit");
  }
  for (const image of images) {
    bytes += image.data.length;
    if (
      !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
        image.mimeType
      ) ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(image.data) ||
      bytes > Math.ceil((8 * 1024 * 1024) / 3) * 4
    ) {
      throw new Error("runtime:sandbox-tools:unsupported-or-oversized-image");
    }
  }
}

export type SandboxToolsBackendOptions = {
  provider: SandboxProvider;
  /** Platform-controlled allocation/authorization, never parsed from model args. */
  sandboxSpec: (spec: RuntimeSpec, runId: string) => Promise<SandboxSpec>;
  authorizeTool: (
    spec: RuntimeSpec,
    toolCallId: string,
    toolName: string
  ) => Promise<void>;
  /** Empty by default. Explicit platform closures only; no extensions/MCP. */
  allowedPlatformToolNames?: readonly string[];
  /** Platform-bound identity/private persistence + archive, not a model URL. */
  publishArtifact?: (
    spec: RuntimeSpec,
    input: SandboxArtifactInput
  ) => Promise<RuntimeArtifact>;
};

/** Host official Pi loop + lazy execution-only sandbox. No model credentials,
 * host cwd/env, package code or MCP are sent to the sandbox. This adapter is not
 * production-wired until persisted intent, private delivery and Worker gates.
 * Docker is the initial validated execution adapter, not a production rollout
 * claim. OpenSandbox tools stay blocked until its launcher/control-path and new
 * contract gates are verified.
 */
export class SandboxToolsBackend implements RuntimeBackend {
  private readonly options: SandboxToolsBackendOptions;

  constructor(options: SandboxToolsBackendOptions) {
    if (options.provider.name === "opensandbox") {
      throw new Error("runtime:sandbox-tools:opensandbox-not-verified");
    }
    this.options = options;
  }

  async open(spec: RuntimeSpec): Promise<RuntimeSession> {
    if (!spec.workspaceDir) {
      throw new Error("runtime:sandbox-tools:workspace-required");
    }
    const allowed = new Set(this.options.allowedPlatformToolNames ?? []);
    const names = new Set<string>();
    for (const tool of spec.tools) {
      if (
        !allowed.has(tool.name) ||
        RESERVED_TOOLS.has(tool.name) ||
        names.has(tool.name)
      ) {
        throw new Error(`runtime:sandbox-tools:unapproved-tool:${tool.name}`);
      }
      names.add(tool.name);
    }
    const runId = spec.runId ?? globalThis.crypto.randomUUID();
    const allocation = await this.options.sandboxSpec(spec, runId);
    if (
      allocation.runId !== runId ||
      allocation.chatId !== spec.chatId ||
      allocation.workspaceVolume.source !== spec.workspaceDir ||
      allocation.egress.mode !== "deny-all"
    ) {
      throw new Error("runtime:sandbox-tools:invalid-allocation");
    }
    const queue = new AsyncEventQueue<RuntimeEvent>();
    let handle: SandboxHandle | undefined;
    let stopRenewal: (() => void) | undefined;
    let session: AgentSession | undefined;
    let fatal: unknown;
    const recordFailure = (error: unknown) => {
      fatal ??= error;
      // Agent.abort waits for its executing tool; do not await it in that tool.
      session?.abort().catch(() => undefined);
    };
    const { provider } = this.options;
    const tracked: SandboxProvider = {
      acquire: async (request) => {
        handle = await provider.acquire(request);
        stopRenewal = startSandboxRenewalLoop(handle, request.ttlSeconds);
        return handle;
      },
      attach: (id) => provider.attach(id),
      name: provider.name,
      release: (resource, policy) => provider.release(resource, policy),
    };
    const lazy = new LazySandbox(tracked, allocation);
    const authorize = async (id: string, name: string) => {
      try {
        await this.options.authorizeTool(spec, id, name);
      } catch (error) {
        recordFailure(error);
        throw error;
      }
    };
    const { publishArtifact } = this.options;
    const bundle = createSandboxTools({
      authorize,
      lazy,
      onFatalError: recordFailure,
      runId,
      ...(publishArtifact
        ? {
            onArtifact: (artifact: RuntimeArtifact) =>
              queue.push({ file: artifact, type: "artifact.created" }),
            publishArtifact: (input: SandboxArtifactInput) =>
              publishArtifact(spec, input),
          }
        : {}),
    });
    let cleanup: Promise<void> | undefined;
    const finish = () => {
      cleanup ??= (async () => {
        stopRenewal?.();
        await bundle.close();
        if (handle && (await handle.status()) !== "destroyed") {
          throw new Error("runtime:sandbox-tools:termination-unconfirmed");
        }
      })();
      cleanup.catch(() => undefined);
      return cleanup;
    };
    try {
      const platformTools = spec.tools.map((tool) => ({
        ...tool,
        execute: async (...args: Parameters<typeof tool.execute>) => {
          await authorize(args[0], tool.name);
          try {
            const result = await tool.execute(...args);
            validateImages(
              result.content.filter((block) => block.type === "image")
            );
            return result;
          } catch (error) {
            recordFailure(error);
            throw error;
          }
        },
      }));
      const agent = await createPiworkAgentSession({
        appendSystemPrompt: [
          ...spec.appendSystemPrompt,
          "Execution tools run only in an isolated sandbox. Use workspace-relative file paths. No host filesystem, extensions or MCP access. Deliver final files only through deliver_file when that tool is enabled.",
        ],
        cwd: MANAGED_AGENT_DIR,
        disableBuiltinTools: true,
        disableImageAutoResize: true,
        historyMessages: spec.historyMessages,
        model: spec.model,
        systemPrompt: spec.systemPrompt,
        tools: [...platformTools, ...bundle.tools],
      });
      ({ session } = agent);
      return new InProcessRuntimeSession(agent.dispose, agent.session, queue, {
        beforeTerminal: finish,
        failure: () => fatal,
        onAbort: finish,
        runId,
        validateCommand: (command) => {
          if (!("images" in command) || !command.images) {
            return;
          }
          validateImages(command.images);
        },
      });
    } catch (error) {
      try {
        await finish();
      } catch (cleanupError) {
        throw sandboxCleanupFailure(
          "Session creation and cleanup failed",
          error,
          cleanupError
        );
      }
      throw error;
    }
  }
}
