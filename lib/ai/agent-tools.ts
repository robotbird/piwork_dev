import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type AgentHarnessTool,
  type AgentTool,
  createBashTool,
  createEditTool,
  createReadTool,
  createWriteTool,
  type ExecutionToolContext,
} from "@earendil-works/pi-agent-core";
import { NodeExecutionEnv } from "@earendil-works/pi-agent-core/node";
import { Type } from "@earendil-works/pi-ai";
import type { ChatMessage, DeliveredFileData } from "@/lib/types";
import { getSupportedAttachmentType } from "./attachment-types";
import { downloadAttachment } from "./attachments";
import { storeFile } from "./file-store";

export const MAX_DELIVER_FILE_SIZE = 50 * 1024 * 1024;

// 部署到不受信环境时可通过 PIWORK_DISABLE_EXECUTION_TOOLS 关闭执行类工具。
export function executionToolsEnabled() {
  return !process.env.PIWORK_DISABLE_EXECUTION_TOOLS;
}

const CHAT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function chatWorkspaceDir(chatId: string, cwd = process.cwd()) {
  if (!CHAT_ID_PATTERN.test(chatId)) {
    throw new Error("Invalid chat id");
  }
  return path.join(cwd, ".pi", "workspace", chatId);
}

export async function ensureChatWorkspace(chatId: string) {
  const dir = chatWorkspaceDir(chatId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function removeChatWorkspace(chatId: string) {
  await rm(chatWorkspaceDir(chatId), { force: true, recursive: true }).catch(
    () => undefined
  );
}

export function isInsideWorkspace(workspaceDir: string, target: string) {
  const resolved = path.resolve(workspaceDir, target);
  const rel = path.relative(path.resolve(workspaceDir), resolved);
  return (
    rel !== "" &&
    rel !== ".." &&
    !rel.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(rel)
  );
}

// pi-agent-core 的执行类工具是 AgentHarnessTool（execute 需要第 5 个参数
// context: {env}），而底层 Agent 类按 AgentTool 的 4 参签名调用；
// 这里闭包注入 context 做适配，否则工具执行时会在 context.env 上崩溃。
function bindToolContext(
  tool: AgentHarnessTool<ExecutionToolContext>,
  context: ExecutionToolContext
): AgentTool {
  return {
    ...tool,
    execute: (toolCallId, params, signal, onUpdate) =>
      tool.execute(toolCallId, params, signal, onUpdate, context),
  };
}

export function createExecutionTools(workspaceDir: string) {
  const env = new NodeExecutionEnv({ cwd: workspaceDir });
  const tools = [
    bindToolContext(createBashTool(), { env }),
    bindToolContext(createReadTool(), { env }),
    bindToolContext(createWriteTool(), { env }),
    bindToolContext(createEditTool(), { env }),
  ];
  return { cleanup: () => env.cleanup(), env, tools };
}

export function createDeliverFileTool({
  workspaceDir,
  onDelivered,
}: {
  workspaceDir: string;
  onDelivered: (file: DeliveredFileData) => void;
}): AgentTool {
  return {
    description:
      "Deliver a generated file from the chat workspace to the user as a downloadable attachment card in the chat. Use it for final artifacts (.pptx, .pdf, .xlsx, images, ...). The path must reference a file inside the current workspace.",
    execute: async (_toolCallId, params) => {
      const { path: target } = params as { path: string };
      if (!isInsideWorkspace(workspaceDir, target)) {
        throw new Error("deliver_file: path must be inside the chat workspace");
      }

      const absolute = path.resolve(workspaceDir, target);
      const info = await stat(absolute);
      if (!info.isFile()) {
        throw new Error(`deliver_file: not a file: ${target}`);
      }
      if (info.size > MAX_DELIVER_FILE_SIZE) {
        throw new Error("deliver_file: file exceeds the 50 MB limit");
      }

      const filename = path.basename(absolute);
      const contentType =
        getSupportedAttachmentType(filename)?.mediaType ??
        "application/octet-stream";
      const content = await readFile(absolute);
      const stored = await storeFile({
        buffer: content,
        contentType,
        filename,
      });

      onDelivered({
        contentType,
        filename,
        url: stored.url,
        ...(stored.downloadUrl ? { downloadUrl: stored.downloadUrl } : {}),
      });

      return {
        content: [
          {
            text: `Delivered "${filename}" (${info.size} bytes) to the user as a downloadable attachment card. Briefly confirm the delivery in the user's language.`,
            type: "text",
          },
        ],
        details: { filename, url: stored.url },
      };
    },
    executionMode: "sequential",
    label: "Deliver file",
    name: "deliver_file",
    parameters: Type.Object({
      path: Type.String({
        description: "Path of the file to deliver, relative to the workspace",
      }),
    }),
  };
}

const TOOL_LABELS: Record<string, string> = {
  bash: "执行命令",
  create_skill: "创建技能",
  deliver_file: "交付文件",
  edit: "编辑文件",
  load_skill: "加载技能",
  read: "读取文件",
  write: "写入文件",
};

export function formatToolStatus(
  phase: "start" | "end",
  toolName: string,
  args?: unknown,
  isError = false
) {
  const label = TOOL_LABELS[toolName] ?? toolName;
  if (phase === "end") {
    return isError ? `${label}失败` : `${label}完成`;
  }

  const a = (args ?? {}) as Record<string, unknown>;
  const detail =
    toolName === "bash" && typeof a.command === "string"
      ? `: ${a.command.slice(0, 80)}`
      : typeof a.path === "string"
        ? `: ${a.path}`
        : toolName === "load_skill" && typeof a.name === "string"
          ? `: ${a.name}`
          : "";
  return `正在${label}${detail}`;
}

// 将本轮用户上传附件的原始字节落盘到工作区，供 skill 脚本直接读取
// （如 drawio 转换脚本需要原始压缩 XML，比文本注入更保真）。
export async function writeAttachmentsToWorkspace(
  message: ChatMessage,
  workspaceDir: string,
  signal?: AbortSignal
) {
  const parts = message.parts.filter((part) => part.type === "file");
  const usedNames = new Set<string>();

  // 先确定每个附件的唯一落盘文件名，再并行下载写盘。
  const targets = parts.map((part) => {
    const rawName = part.filename ?? "attachment";
    const baseName =
      path.basename(rawName.replaceAll("\\", "/")) || "attachment";

    let safeName = baseName;
    let counter = 2;
    while (usedNames.has(safeName)) {
      const ext = path.extname(baseName);
      const stem = path.basename(baseName, ext);
      safeName = `${stem}-${counter}${ext}`;
      counter += 1;
    }
    usedNames.add(safeName);
    return { part, rawName, safeName };
  });

  const written = await Promise.all(
    targets.map(async ({ part, rawName, safeName }) => {
      const content = await downloadAttachment(
        { filename: rawName, mediaType: part.mediaType, url: part.url },
        signal
      );
      await writeFile(path.join(workspaceDir, safeName), content);
      return safeName;
    })
  );
  return written;
}

export function buildExecutionSystemPrompt(
  workspaceDir: string,
  attachmentFiles: string[]
) {
  const fileList =
    attachmentFiles.length > 0
      ? attachmentFiles.join(", ")
      : "none in this turn (files from earlier turns may still be there)";
  return `## Workspace and execution tools

You have bash, read, write, and edit tools to carry out tasks such as running skill scripts.

- Your working directory (workspace) is: ${workspaceDir}. Relative paths in commands and file tools resolve against it; prefer relative paths.
- Files uploaded by the user in this turn are saved in the workspace: ${fileList}.
- Skill script locations given in <skill> blocks are absolute paths outside the workspace; run them from the workspace, e.g.: python3 /abs/path/.pi/skills/<name>/scripts/tool.py input.drawio -o output.pptx
- Keep commands non-interactive. If a skill needs missing dependencies (e.g. Python packages), install them first (pip install ...).
- Pass a bash timeout in seconds when a command may run long (max 120).
- When you produce a final artifact, call deliver_file with its workspace path so the user receives a downloadable attachment card, then briefly confirm in the user's language.`;
}
