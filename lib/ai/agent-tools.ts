import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { ChatMessage, DeliveredFileData } from "@/lib/types";
import { getSupportedAttachmentType } from "./attachment-types";
import { downloadAttachment } from "./attachments";
import { type StoredFile, storeFile } from "./file-store";

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

export function createDeliverFileTool({
  workspaceDir,
  onDelivered,
  onStored,
}: {
  workspaceDir: string;
  onDelivered: (file: DeliveredFileData) => void;
  onStored?: (file: StoredFile, size: number) => Promise<void>;
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

      await onStored?.(stored, content.byteLength);

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

/**
 * piwork 侧 AgentTool（4 参 execute）适配为 createAgentSession customTools
 * 需要的 ToolDefinition（5 参，第 5 参 ExtensionContext 在无宿主依赖的
 * 工具里用不到，丢弃即可）。promptSnippet 必须合成：缺省时 customTools
 * 不进系统提示的 Available tools 段。
 */
export function agentToolToToolDefinition(tool: AgentTool): ToolDefinition {
  return {
    ...tool,
    execute: (toolCallId, params, signal, onUpdate, _ctx) =>
      tool.execute(toolCallId, params, signal, onUpdate),
    promptSnippet: promptSnippetFromDescription(tool.description),
  };
}

function promptSnippetFromDescription(description: string) {
  const firstSentence = description.match(/^[^。.!?\n]+[。.]?/)?.[0] ?? "";
  return firstSentence.trim().slice(0, 120) || description.slice(0, 120);
}

const TOOL_LABELS: Record<string, string> = {
  bash: "执行命令",
  create_skill: "创建技能",
  deliver_file: "交付文件",
  edit: "编辑文件",
  load_skill: "加载技能",
  mcp: "MCP 调用",
  mcpScript: "MCP 脚本",
  platform_web_search: "联网搜索",
  read: "读取文件",
  write: "写入文件",
};

export function formatToolStatus(
  phase: "start" | "end",
  toolName: string,
  args?: unknown,
  isError = false
) {
  // mcp 命名空间代理形如 mcp__<server>__<tool>，展示成 <server>/<tool>
  let label = TOOL_LABELS[toolName] ?? toolName;
  if (toolName.startsWith("mcp__")) {
    const segments = toolName.split("__").slice(1);
    label = segments.length > 1 ? segments.join("/") : toolName;
  }
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
- Resolve skill scripts, references, and assets from the exact Skill directory provided in the current instructions; do not guess a host path. Run scripts with an existing interpreter (node, python3, sh) from the workspace.
- Keep commands non-interactive. If required dependencies are missing, report them clearly; do not install packages at runtime.
- Pass a bash timeout (seconds) when a command may run long.
- MCP tools (mcp for single calls, mcpScript for multi-call scripts) reach the MCP services configured for this workspace; use them for MCP work instead of hand-writing JSON-RPC.
- When you produce a final artifact, call deliver_file with its workspace path so the user receives a downloadable attachment card, then briefly confirm in the user's language.`;
}
