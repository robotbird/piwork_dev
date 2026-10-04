import { posix } from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import {
  createBashToolDefinition,
  createEditTool,
  createEditToolDefinition,
  createReadToolDefinition,
  createWriteTool,
  createWriteToolDefinition,
  type EditToolInput,
  type ReadToolInput,
  truncateHead,
  truncateTail,
  type WriteToolInput,
} from "@earendil-works/pi-coding-agent";
import { getSupportedAttachmentType } from "@/lib/ai/attachment-types";
import type { RuntimeArtifact } from "../../protocol";
import type { SandboxFilesystem } from "../../sandbox/filesystem";
import type { LazySandbox } from "../../sandbox/lazy";
import { SandboxOperationError } from "../../sandbox/operation-error";

export type SandboxArtifactInput = {
  runId: string;
  toolCallId: string;
  path: string;
  filename: string;
  contentType: string;
  sha256: string;
  content: Uint8Array;
  signal?: AbortSignal;
};

import { SandboxToolRuntime } from "./tool-runtime";

const FILE_LIMIT = 50 * 1024 * 1024;
const IMAGE_LIMIT = 8 * 1024 * 1024;
const OUTPUT_TAIL_BYTES = 100 * 1024;
const OUTPUT_STREAM_LIMIT = 10 * 1024 * 1024;

/** No SDK default local execution is used. Edit/write delegate official semantic
 * logic through custom operations; read/bash reuse schemas and truncation but
 * avoid host path probing, image decoding, env forwarding and temp-log spooling.
 * Caller supplies platform authorization (and, in P2, persisted operation intent).
 */
export function createSandboxTools(options: {
  lazy: LazySandbox;
  runId: string;
  authorize: (toolCallId: string, toolName: string) => Promise<void>;
  /** Must not await agent.abort() from inside its own executing tool. */
  onFatalError?: (error: unknown) => void;
  /** Must privately persist and idempotently archive BEFORE resolving. */
  publishArtifact?: (input: SandboxArtifactInput) => Promise<RuntimeArtifact>;
  onArtifact?: (artifact: RuntimeArtifact) => void;
}) {
  const runtime = new SandboxToolRuntime(options.lazy);
  const filesystem = async (): Promise<{
    fs: SandboxFilesystem;
    cwd: string;
  }> => {
    const handle = await runtime.ensure();
    if (!handle.filesystem) {
      throw new Error(
        "Sandbox provider lacks bounded atomic filesystem capability"
      );
    }
    return { cwd: handle.workspaceRoot, fs: handle.filesystem };
  };
  const invoke = <T>(
    id: string,
    name: string,
    signal: AbortSignal | undefined,
    action: () => Promise<T>
  ) =>
    runtime
      .exclusive(async () => {
        await options.authorize(id, name);
        signal?.throwIfAborted();
        return action();
      }, signal)
      .catch((error: unknown) => {
        if (
          error instanceof SandboxOperationError &&
          error.phase === "outcome_unknown"
        ) {
          options.onFatalError?.(error);
        }
        throw error;
      });

  const read = createReadToolDefinition("/workspace", {
    autoResizeImages: false,
  });
  const edit = createEditToolDefinition("/workspace");
  const write = createWriteToolDefinition("/workspace");
  const bash = createBashToolDefinition("/workspace", {
    exposeSessionEnvironment: false,
  });

  const tools: AgentTool[] = [
    {
      ...read,
      description: `${read.description} Paths refer only to the sandbox workspace. PDF/Office parsing must run with bash inside the sandbox; read the extracted text. Large images must be resized inside the sandbox.`,
      execute: (id, params, signal) =>
        invoke(id, "read", signal, async () => {
          const { fs, cwd } = await filesystem();
          const input = params as ReadToolInput;
          const target = resolveSandboxPath(cwd, input.path);
          const file = await fs.read(target, FILE_LIMIT, signal);
          const content = Buffer.from(file.content);
          const mimeType = imageMime(content);
          if (mimeType) {
            if (content.length > IMAGE_LIMIT) {
              throw new Error(
                "Image exceeds 8 MB; resize it with sandbox bash before reading"
              );
            }
            return {
              content: [
                {
                  text: `Read sandbox image [${mimeType}]`,
                  type: "text" as const,
                },
                {
                  data: content.toString("base64"),
                  mimeType,
                  type: "image" as const,
                },
              ],
              details: undefined,
            };
          }
          if (
            /\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp)$/i.test(input.path) ||
            content.subarray(0, 4).toString() === "%PDF"
          ) {
            throw new Error(
              "Use sandbox bash to extract PDF/Office text, then read the resulting text file. Parsing is not performed on the host."
            );
          }
          return readText(content.toString("utf8"), input);
        }),
      executionMode: "sequential",
    },
    {
      ...edit,
      execute: (id, params, signal, onUpdate) =>
        invoke(id, "edit", signal, async () => {
          const { fs, cwd } = await filesystem();
          const input = params as EditToolInput;
          resolveSandboxPath(cwd, input.path);
          let expectedSha256: string | undefined;
          const official = createEditTool(cwd, {
            operations: {
              access: async (target) => {
                if (!(await fs.stat(target, signal))) {
                  throw new Error("File not found");
                }
              },
              readFile: async (target) => {
                const original = await fs.read(target, FILE_LIMIT, signal);
                expectedSha256 = original.sha256;
                return Buffer.from(original.content);
              },
              writeFile: async (target, content) => {
                if (!expectedSha256) {
                  throw new Error("Missing edit version precondition");
                }
                await fs.writeAtomic({
                  content: Buffer.from(content),
                  expectedSha256,
                  maxBytes: FILE_LIMIT,
                  path: target,
                  signal,
                });
              },
            },
          });
          return official.execute(id, input, signal, onUpdate);
        }),
      executionMode: "sequential",
    },
    {
      ...write,
      execute: (id, params, signal, onUpdate) =>
        invoke(id, "write", signal, async () => {
          const { fs, cwd } = await filesystem();
          const input = params as WriteToolInput;
          const target = resolveSandboxPath(cwd, input.path);
          if (Buffer.byteLength(input.content) > FILE_LIMIT) {
            throw new Error("Write exceeds 50 MB limit");
          }
          const current = await fs.stat(target, signal);
          const expectedSha256 = current
            ? (await fs.read(target, FILE_LIMIT, signal)).sha256
            : null;
          const official = createWriteTool(cwd, {
            operations: {
              // Atomic helper creates/validates parents while holding its pinned dir.
              mkdir: () => Promise.resolve(),
              writeFile: (destination, content) =>
                fs.writeAtomic({
                  content: Buffer.from(content),
                  expectedSha256,
                  maxBytes: FILE_LIMIT,
                  path: destination,
                  signal,
                }),
            },
          });
          return official.execute(id, input, signal, onUpdate);
        }),
      executionMode: "sequential",
    },
    {
      ...bash,
      description:
        "Execute a shell command only in the sandbox workspace. Default timeout 120s, maximum 1800s. Output is bounded to the last 200 lines/50KB; no host log files are created. Timeout, abort or unknown outcome stops the entire sandbox; commands are never automatically replayed.",
      execute: (id, params, signal, onUpdate) =>
        invoke(id, "bash", signal, async () => {
          const { command, timeout = 120 } = params as {
            command: string;
            timeout?: number;
          };
          const startedAt = performance.now();
          let tail = Buffer.alloc(0);
          let totalBytes = 0;
          let lastUpdate = 0;
          const snapshot = () => {
            // Avoid leading UTF-8 continuation bytes when slicing a rolling tail.
            let start = 0;
            while (start < tail.length && (tail[start] & 0xc0) === 0x80) {
              start += 1;
            }
            const result = truncateTail(tail.subarray(start).toString("utf8"), {
              maxBytes: 50 * 1024,
              maxLines: 200,
            });
            const truncated = totalBytes > tail.length || result.truncated;
            return { ...result, truncated };
          };
          const { exitCode } = await runtime.executeCommand({
            command,
            maxOutputBytes: OUTPUT_STREAM_LIMIT,
            onData: (chunk) => {
              totalBytes += chunk.length;
              if (chunk.length >= OUTPUT_TAIL_BYTES) {
                tail = Buffer.from(
                  chunk.subarray(chunk.length - OUTPUT_TAIL_BYTES)
                );
              } else {
                const joined = Buffer.concat([tail, chunk]);
                tail = joined.subarray(
                  Math.max(0, joined.length - OUTPUT_TAIL_BYTES)
                );
              }
              if (onUpdate && Date.now() - lastUpdate >= 100) {
                lastUpdate = Date.now();
                onUpdate({
                  content: [{ text: snapshot().content, type: "text" }],
                  details: undefined,
                });
              }
            },
            operationId: `${options.runId}:${id}`,
            signal,
            timeoutSeconds: timeout,
          });
          const output = snapshot();
          let text = output.content || "(no output)";
          if (output.truncated) {
            text +=
              "\n\n[Output truncated. Redirect large results into a workspace file and read it in sections.]";
          }
          if (exitCode !== 0) {
            text += `\n\n[exit code: ${exitCode}]`;
          }
          return {
            content: [{ text, type: "text" as const }],
            details: undefined,
            isError: exitCode !== 0,
            structuredContent: {
              exit_code: exitCode ?? -1,
              output: output.content,
              truncated: output.truncated,
              wall_time_seconds:
                Math.round((performance.now() - startedAt) / 100) / 10,
            },
          };
        }),
      executionMode: "sequential",
    },
  ];
  if (options.publishArtifact) {
    const delivered = new Map<
      string,
      { path: string; artifact: RuntimeArtifact }
    >();
    const publish = options.publishArtifact;
    tools.push({
      description:
        "Privately deliver a final file from the sandbox workspace. Archive before announcing success. Paths must be workspace-relative; maximum 50 MB.",
      execute: (id, params, signal) =>
        invoke(id, "deliver_file", signal, async () => {
          const input = params as { path: string };
          const previous = delivered.get(id);
          if (previous) {
            if (previous.path !== input.path) {
              throw new Error("Artifact operation ID/path conflict");
            }
            return {
              content: [
                {
                  text: JSON.stringify(previous.artifact),
                  type: "text" as const,
                },
              ],
              details: undefined,
            };
          }
          if (delivered.size >= 1000) {
            throw new Error("Artifact count limit reached");
          }
          const { fs, cwd } = await filesystem();
          const filename = posix.basename(input.path);
          if (filename.length > 180) {
            throw new Error("Delivery filename exceeds limit");
          }
          const file = await fs.read(
            resolveSandboxPath(cwd, input.path),
            FILE_LIMIT,
            signal
          );
          let artifact: RuntimeArtifact;
          try {
            artifact = await publish({
              content: file.content,
              contentType:
                getSupportedAttachmentType(filename)?.mediaType ??
                "application/octet-stream",
              filename,
              path: input.path,
              runId: options.runId,
              sha256: file.sha256,
              signal,
              toolCallId: id,
            });
            signal?.throwIfAborted();
            if (
              !/^\/api\/(files|library)\/[a-zA-Z0-9._-]+$/.test(artifact.url) ||
              (artifact.downloadUrl &&
                artifact.downloadUrl !== artifact.url &&
                artifact.downloadUrl !== `${artifact.url}?download=1`)
            ) {
              throw new Error(
                "Artifact publisher must return a protected platform URL"
              );
            }
          } catch (error) {
            throw new SandboxOperationError(
              "Artifact publication outcome unknown; do not retry automatically",
              { cause: error, phase: "outcome_unknown" }
            );
          }
          delivered.set(id, { artifact, path: input.path });
          options.onArtifact?.(artifact);
          return {
            content: [
              { text: JSON.stringify(artifact), type: "text" as const },
            ],
            details: undefined,
          };
        }),
      executionMode: "sequential",
      label: "交付文件",
      name: "deliver_file",
      parameters: Type.Object({ path: Type.String() }),
    });
  }
  return {
    close: () => runtime.close(),
    observation: (id: string) => runtime.observation(`${options.runId}:${id}`),
    tools,
  };
}

function resolveSandboxPath(cwd: string, input: string): string {
  // POSIX only; no tilde/host-home expansion and no screenshot path probing.
  if (input.includes("\\") || input.includes("\0") || input.startsWith("~")) {
    throw new Error("Invalid sandbox path");
  }
  const relative = input.startsWith(`${cwd}/`)
    ? input.slice(cwd.length + 1)
    : input;
  if (
    !relative ||
    relative.startsWith("/") ||
    relative.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error("Path must name a file inside the sandbox workspace");
  }
  return `${cwd}/${relative}`;
}

function imageMime(buffer: Buffer): string | undefined {
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return "image/png";
  }
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    return "image/jpeg";
  }
  if (/^GIF8[79]a$/.test(buffer.subarray(0, 6).toString())) {
    return "image/gif";
  }
  if (
    buffer.subarray(0, 4).toString() === "RIFF" &&
    buffer.subarray(8, 12).toString() === "WEBP"
  ) {
    return "image/webp";
  }
}

function readText(text: string, input: ReadToolInput) {
  const start = input.offset ? Math.max(0, input.offset - 1) : 0;
  if (
    !Number.isSafeInteger(start) ||
    (input.limit !== undefined &&
      (!Number.isSafeInteger(input.limit) || input.limit <= 0))
  ) {
    throw new Error("Invalid read offset/limit");
  }
  // Never split the whole input: newline-heavy files otherwise amplify a bounded
  // 50MB buffer into millions of host objects. Only split a bounded SDK window.
  let cursor = 0;
  for (let line = 0; line < start; line += 1) {
    const next = text.indexOf("\n", cursor);
    if (next < 0) {
      throw new Error("Read offset exceeds file length");
    }
    cursor = next + 1;
  }
  const charEnd = Math.min(text.length, cursor + 50 * 1024 + 1);
  const lineLimit = Math.min(input.limit ?? 2001, 2001);
  let end = cursor;
  for (let count = 1; count <= lineLimit && end < charEnd; count += 1) {
    const next = text.indexOf("\n", end);
    if (next < 0 || next >= charEnd) {
      end = charEnd;
      break;
    }
    end = input.limit !== undefined && count === input.limit ? next : next + 1;
  }
  const result = truncateHead(text.slice(cursor, end));
  let output = result.content;
  if (result.firstLineExceedsLimit) {
    output = "[Line exceeds 50KB. Use sandbox bash to split the file.]";
  } else if (result.truncated || end < text.length) {
    output += `\n\n[More lines remain. Use offset=${start + result.outputLines + 1} to continue.]`;
  }
  return {
    content: [{ text: output, type: "text" as const }],
    details: result.truncated ? { truncation: result } : undefined,
  };
}
