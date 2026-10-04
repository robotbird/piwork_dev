import { createHash } from "node:crypto";
import type { SandboxHandle } from "./index";
import {
  SandboxOperationError,
  sandboxCleanupFailure,
} from "./operation-error";
import { REMOTE_FILES_SCRIPT } from "./remote-files-script";

export type SandboxFile = { content: Uint8Array; sha256: string };
export type SandboxFileInfo = { size: number };
export interface SandboxFilesystem {
  read: (
    path: string,
    maxBytes: number,
    signal?: AbortSignal
  ) => Promise<SandboxFile>;
  stat: (path: string, signal?: AbortSignal) => Promise<SandboxFileInfo | null>;
  writeAtomic: (input: {
    path: string;
    content: Uint8Array;
    expectedSha256: string | null;
    maxBytes: number;
    signal?: AbortSignal;
  }) => Promise<void>;
}

const MAX_TRANSFER_BYTES = 50 * 1024 * 1024;
const MAX_REPLY_OVERHEAD = 4096;
const FILE_OPERATION_TIMEOUT_MS = 30_000;

type Reply = {
  ok: boolean;
  code?: string;
  message?: string;
  phase?: "completed" | "outcome_unknown";
  content?: string;
  sha256?: string;
  size?: number;
  missing?: boolean;
};

/** Executes a shipped, fixed Node helper by argv, not a model-generated script.
 * Linux pins every directory through /proc/self/fd; no workspace launcher/control
 * files. Non-Linux fallback is explicitly test-only. Existing RPC read/write API
 * stays unchanged. Transport failure/timeout destroys the whole sandbox, never
 * retries a write. Still requires workspace ownership and operation audit in P2.
 */
export function createSandboxFilesystem(
  handle: SandboxHandle,
  options: { nodePath?: string; allowUnanchoredTestPaths?: boolean } = {}
): SandboxFilesystem {
  const request = async (
    input: Record<string, unknown>,
    maxReplyBytes: number,
    signal?: AbortSignal,
    content?: Uint8Array
  ): Promise<Reply> => {
    signal?.throwIfAborted();
    if ((await handle.status()) === "destroyed") {
      throw new SandboxOperationError("Sandbox is destroyed", {
        phase: "not_started",
      });
    }
    const metadata = JSON.stringify({
      ...input,
      allowUnanchoredTestPaths: options.allowUnanchoredTestPaths ?? false,
      root: handle.workspaceRoot,
    });
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error("File operation timed out")),
      FILE_OPERATION_TIMEOUT_MS
    );
    const combined = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;
    let channel: Awaited<ReturnType<SandboxHandle["startProcess"]>> | undefined;
    let rejectedByTransport = true;
    let cancel!: () => void;
    const aborted = new Promise<never>((_resolve, reject) => {
      cancel = () => reject(combined.reason);
      if (combined.aborted) {
        cancel();
      } else {
        combined.addEventListener("abort", cancel, { once: true });
      }
    });
    // Always observe the losing branch, including late startProcess failures.
    aborted.catch(() => undefined);
    const work = (async () => {
      combined.throwIfAborted();
      channel = await handle.startProcess({
        argv: [options.nodePath ?? "node", "-e", REMOTE_FILES_SCRIPT, metadata],
        cwd: handle.workspaceRoot,
      });
      if (combined.aborted) {
        await channel.close();
        throw combined.reason;
      }
      const activeChannel = channel;
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      const reading = (async () => {
        for await (const chunk of activeChannel.read()) {
          bytes += chunk.length;
          if (bytes > maxReplyBytes) {
            throw new Error("File helper reply exceeds limit");
          }
          chunks.push(chunk);
        }
      })();
      reading.catch(() => undefined);
      if (content?.length) {
        await channel.write(content);
      }
      await reading;
      const exit = await channel.onExit;
      if (exit.code !== 0) {
        throw new Error("File helper terminated without a valid result");
      }
      const reply: Reply = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (typeof reply.ok !== "boolean") {
        throw new Error("Invalid file helper result");
      }
      rejectedByTransport = false;
      if (!reply.ok) {
        throw new SandboxOperationError(
          `sandbox:file:${reply.code}: ${reply.message}`,
          {
            phase:
              reply.phase === "outcome_unknown"
                ? "outcome_unknown"
                : "completed",
          }
        );
      }
      return reply;
    })();
    work.catch(() => undefined);
    try {
      return await Promise.race([work, aborted]);
    } catch (cause) {
      if (rejectedByTransport) {
        try {
          await handle.destroy("kill");
          if ((await handle.status()) !== "destroyed") {
            throw new Error("Sandbox termination not confirmed", { cause });
          }
        } catch (cleanupError) {
          throw sandboxCleanupFailure(
            "File outcome unknown; sandbox cleanup failed",
            cause,
            cleanupError
          );
        }
        throw new SandboxOperationError(
          "File outcome unknown; sandbox stopped. Do not automatically retry.",
          {
            cause,
            phase: "outcome_unknown",
          }
        );
      }
      throw cause;
    } finally {
      clearTimeout(timer);
      combined.removeEventListener("abort", cancel);
      if (channel) {
        await channel.close().catch(() => undefined);
      }
    }
  };
  const assertLimit = (maxBytes: number) => {
    if (
      !Number.isSafeInteger(maxBytes) ||
      maxBytes <= 0 ||
      maxBytes > MAX_TRANSFER_BYTES
    ) {
      throw new SandboxOperationError("Invalid file transfer limit", {
        phase: "not_started",
      });
    }
  };
  return {
    read: async (path, maxBytes, signal) => {
      assertLimit(maxBytes);
      const reply = await request(
        { action: "read", maxBytes, path },
        Math.ceil(maxBytes / 3) * 4 + MAX_REPLY_OVERHEAD,
        signal
      );
      if (
        typeof reply.content !== "string" ||
        typeof reply.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(reply.sha256)
      ) {
        throw new Error("Invalid file read result");
      }
      const content = Buffer.from(reply.content, "base64");
      if (
        content.length > maxBytes ||
        createHash("sha256").update(content).digest("hex") !== reply.sha256
      ) {
        throw new Error("File transfer hash/limit mismatch");
      }
      return { content, sha256: reply.sha256 };
    },
    stat: async (path, signal) => {
      const reply = await request(
        { action: "stat", path },
        MAX_REPLY_OVERHEAD,
        signal
      );
      if (reply.missing) {
        return null;
      }
      if (
        typeof reply.size !== "number" ||
        !Number.isSafeInteger(reply.size) ||
        reply.size < 0
      ) {
        throw new Error("Invalid file stat result");
      }
      return { size: reply.size };
    },
    writeAtomic: async ({
      path,
      content,
      expectedSha256,
      maxBytes,
      signal,
    }) => {
      assertLimit(maxBytes);
      if (
        content.length > maxBytes ||
        (expectedSha256 !== null && !/^[a-f0-9]{64}$/.test(expectedSha256))
      ) {
        throw new SandboxOperationError(
          "File write limit/precondition invalid",
          { phase: "not_started" }
        );
      }
      await request(
        {
          action: "write",
          expectedSha256,
          maxBytes,
          path,
          size: content.length,
        },
        MAX_REPLY_OVERHEAD,
        signal,
        content
      );
    },
  };
}
