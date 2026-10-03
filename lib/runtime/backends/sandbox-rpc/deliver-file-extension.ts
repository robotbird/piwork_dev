/**
 * Artifact Gateway 沙箱侧（spec §6 Phase 2 / §8 出站基线）：deliver_file 的
 * pi extension 源码，由 backend 物化进 workspace 并经 --extension 挂载。
 *
 * 沙箱内进程无法直呼控制面回调（storeFile/归档都是宿主能力），故工具只做
 * 校验 + 落 manifest（workspace 内 outbox），出站由宿主侧 artifact-gateway
 * 在收到 tool_execution_end（result.details.manifest）后收割。工具本体零
 * 外部依赖（仅 node 内建 + 纯 JSON Schema 参数——pi 参数校验对无 TypeBox
 * Kind 符号的 plain JSON Schema 有显式支持，pi-ai validation.js:285），
 * 任何底座（本机测试/容器）都无需解析 node_modules。
 */

export const DELIVER_FILE_TOOL_NAME = "deliver_file";
/** workspace 相对（沙箱内视角）落点 */
export const DELIVER_FILE_EXTENSION_PATH = "piwork/extensions/deliver-file.mjs";
export const ARTIFACT_OUTBOX_DIR = "piwork/outbox";

const MAX_DELIVER_FILE_BYTES = 50 * 1024 * 1024;

export function deliverFileExtensionSource(): string {
  return `import { randomUUID } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = ${MAX_DELIVER_FILE_BYTES};

// Artifact Gateway 沙箱侧：校验 + 落 outbox manifest；出站收割在宿主
// （lib/runtime/backends/sandbox-rpc/artifact-gateway.ts）。
export default function deliverFileExtension(pi) {
  pi.registerTool({
    name: "deliver_file",
    label: "Deliver file",
    description:
      "Deliver a generated file from the chat workspace to the user as a downloadable attachment card. Use it for final artifacts (.pptx, .pdf, .xlsx, images, ...). The path must reference a file inside the current workspace.",
    promptSnippet:
      "Deliver a generated file from the workspace to the user as a downloadable attachment card.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path of the file to deliver, relative to the workspace",
        },
      },
      required: ["path"],
    },
    async execute(_toolCallId, params) {
      const cwd = process.cwd();
      const resolved = path.resolve(cwd, params.path);
      const rel = path.relative(cwd, resolved);
      if (
        rel === "" ||
        rel === ".." ||
        rel.startsWith(".." + path.sep) ||
        path.isAbsolute(rel)
      ) {
        throw new Error("deliver_file: path must be inside the chat workspace");
      }
      const info = await stat(resolved);
      if (!info.isFile()) {
        throw new Error("deliver_file: not a file: " + params.path);
      }
      if (info.size > MAX_BYTES) {
        throw new Error("deliver_file: file exceeds the 50 MB limit");
      }
      const id = randomUUID();
      const manifestPath = "piwork/outbox/" + id + ".json";
      const absolute = path.join(cwd, manifestPath);
      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(
        absolute,
        JSON.stringify({
          id: id,
          path: rel.split(path.sep).join("/"),
          filename: path.basename(resolved),
          size: info.size,
        })
      );
      return {
        content: [
          {
            type: "text",
            text:
              'Queued "' +
              path.basename(resolved) +
              '" (' +
              info.size +
              " bytes) for delivery to the user. Briefly confirm the delivery in the user's language.",
          },
        ],
        details: { manifest: manifestPath, id: id },
      };
    },
  });
}
`;
}
