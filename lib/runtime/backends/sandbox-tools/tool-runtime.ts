import type { SandboxHandle } from "../../sandbox";
import type { LazySandbox } from "../../sandbox/lazy";
import {
  SandboxOperationError,
  type SandboxOperationPhase,
  sandboxCleanupFailure,
} from "../../sandbox/operation-error";

export type CommandObservation = {
  operationId: string;
  phase: SandboxOperationPhase;
  exitCode?: number | null;
  processesStopped: boolean;
};

/** Single-run ownership and serial tool execution. Observations are host-owned,
 * never read from model-writable manifests. They are NOT a durable journal:
 * process restart requires P2 DB intent/result reconciliation, never replay.
 */
export class SandboxToolRuntime {
  private readonly lazy: LazySandbox;
  private tail: Promise<void> = Promise.resolve();
  private closed = false;
  private readonly commands = new Map<string, CommandObservation>();

  constructor(lazy: LazySandbox) {
    this.lazy = lazy;
  }

  exclusive<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const result = this.tail.then(async () => {
      signal?.throwIfAborted();
      if (this.closed) {
        throw new Error("runtime:sandbox-tools:closed");
      }
      try {
        return await operation();
      } catch (error) {
        if (
          error instanceof SandboxOperationError &&
          error.phase === "outcome_unknown"
        ) {
          this.closed = true;
          try {
            await this.lazy.close();
          } catch (cleanup) {
            throw sandboxCleanupFailure(
              "Sandbox outcome and cleanup are unknown",
              error,
              cleanup
            );
          }
        }
        throw error;
      }
    });
    this.tail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  ensure(): Promise<SandboxHandle> {
    if (this.closed) {
      return Promise.reject(new Error("runtime:sandbox-tools:closed"));
    }
    return this.lazy.ensure();
  }

  observation(operationId: string): CommandObservation | undefined {
    const entry = this.commands.get(operationId);
    return entry ? { ...entry } : undefined;
  }

  close(): Promise<void> {
    this.closed = true;
    return this.lazy.close();
  }

  async executeCommand(input: {
    operationId: string;
    command: string;
    timeoutSeconds: number;
    signal?: AbortSignal;
    onData: (chunk: Uint8Array) => void;
    maxOutputBytes: number;
  }): Promise<{ exitCode: number | null }> {
    if (this.commands.has(input.operationId)) {
      throw new SandboxOperationError(
        "Operation ID already used; inspect its result, do not replay",
        { phase: "not_started" }
      );
    }
    if (this.commands.size >= 1000) {
      throw new SandboxOperationError("Run command count limit reached", {
        phase: "not_started",
      });
    }
    if (
      !Number.isFinite(input.timeoutSeconds) ||
      input.timeoutSeconds <= 0 ||
      input.timeoutSeconds > 1800 ||
      !Number.isSafeInteger(input.maxOutputBytes) ||
      input.maxOutputBytes <= 0
    ) {
      throw new SandboxOperationError("Invalid command timeout/output limit", {
        phase: "not_started",
      });
    }
    input.signal?.throwIfAborted();
    const entry: CommandObservation = {
      operationId: input.operationId,
      phase: "not_started",
      processesStopped: false,
    };
    this.commands.set(input.operationId, entry);
    const controller = new AbortController();
    const signal = input.signal
      ? AbortSignal.any([input.signal, controller.signal])
      : controller.signal;
    const timer = setTimeout(
      () =>
        controller.abort(
          new Error(
            `Command exceeded ${input.timeoutSeconds}s; sandbox stopped. Split the work before retrying.`
          )
        ),
      input.timeoutSeconds * 1000
    );
    let handle: SandboxHandle | undefined;
    let channel: Awaited<ReturnType<SandboxHandle["startProcess"]>> | undefined;
    let cancel!: () => void;
    const aborted = new Promise<never>((_resolve, reject) => {
      cancel = () => reject(signal.reason);
      if (signal.aborted) {
        cancel();
      } else {
        signal.addEventListener("abort", cancel, { once: true });
      }
    });
    aborted.catch(() => undefined);
    const work = (async () => {
      handle = await this.ensure();
      signal.throwIfAborted();
      // No host env, cwd override, Pi metadata or model credentials are forwarded.
      entry.phase = "started";
      channel = await handle.startProcess({
        argv: ["sh", "-lc", input.command],
        cwd: handle.workspaceRoot,
      });
      if (signal.aborted || this.closed) {
        await channel.close();
        throw signal.reason ?? new Error("Runtime closed");
      }
      let bytes = 0;
      for await (const chunk of channel.readCombined?.() ?? channel.read()) {
        bytes += chunk.length;
        if (bytes > input.maxOutputBytes) {
          throw new Error("Command output limit exceeded; sandbox stopped");
        }
        if (this.closed || signal.aborted) {
          throw new Error("Command interrupted");
        }
        input.onData(chunk);
      }
      const exit = await channel.onExit;
      if (this.closed || signal.aborted || exit.code === null) {
        throw new Error("Command result unknown");
      }
      // Shell exit is not proof that all detached descendants are gone.
      entry.phase = "completed";
      entry.exitCode = exit.code;
      return { exitCode: exit.code };
    })();
    work.catch(() => undefined);
    try {
      return await Promise.race([work, aborted]);
    } catch (cause) {
      entry.phase = "outcome_unknown";
      this.closed = true;
      try {
        await this.lazy.close();
        entry.processesStopped = handle
          ? (await handle.status()) === "destroyed"
          : false;
        if (handle && !entry.processesStopped) {
          throw new Error("Sandbox termination not confirmed", { cause });
        }
      } catch (cleanup) {
        throw sandboxCleanupFailure(
          "Command outcome unknown; sandbox termination failed",
          cause,
          cleanup
        );
      }
      throw new SandboxOperationError(
        `Command outcome unknown; do not replay automatically. ${cause instanceof Error ? cause.message : "Execution interrupted"}`,
        {
          cause,
          phase: "outcome_unknown",
        }
      );
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      if (channel) {
        await channel.close().catch(() => undefined);
      }
    }
  }
}
