import "server-only";

import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { Api, Message, Model } from "@earendil-works/pi-ai";
import {
  type AgentSession,
  CURRENT_SESSION_VERSION,
  createAgentSession,
  createMcpExtension,
  DefaultResourceLoader,
  type ExtensionAPI,
  type FileEntry,
  type LoadExtensionsResult,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { loadPiworkMcpConfig } from "@/lib/mcp/agent-config";
import { createPluginCredentialStore } from "@/lib/model-plugins/pi-credential-store";
import { MANAGED_AGENT_DIR } from "@/lib/pi-packages/agent-dir";
import {
  ensureManagedAgentSettings,
  retireLegacyMcpAdapterPackage,
} from "@/lib/pi-packages/manager";
import { isTestEnvironment } from "../constants";
import { agentToolToToolDefinition } from "./agent-tools";
import { getActivePiProviders } from "./pi";

// e2e 环境未播种 .piwork/pi-agent:PI_OFFLINE 阻止 loader 网络安装,
// 聊天照常工作(无 mcp 工具),保证测试确定性。
if (isTestEnvironment) {
  process.env.PI_OFFLINE ??= "1";
}
// Pi 运行时的 getAgentDir() 兜底路径(mcp.log、mcp-auth.json、OAuth 锁等)
// 指向受管 agentDir,避免触碰宿主 ~/.pi。
process.env.PI_CODING_AGENT_DIR ??= MANAGED_AGENT_DIR;

export type PiworkAgentSessionOptions = {
  /** 追加在会话自带系统提示之后的段落(skills 段 + 执行段) */
  appendSystemPrompt: string[];
  /** 会话 cwd:执行工具开启时为聊天工作区;关闭时为 MANAGED_AGENT_DIR */
  cwd: string;
  /** 轻量会话：关闭内建工具、受管扩展与 MCP，只保留平台显式工具 */
  disableBuiltinTools?: boolean;
  /** Session-local SDK resize suppression. Caller must also reject unsupported MIME to avoid conversion. */
  disableImageAutoResize?: boolean;
  /** 既有对话(有损重建的文本消息) */
  historyMessages: Message[];
  model: Model<Api>;
  /** 基础系统提示(替换 pi 默认 persona;<tools> 段由会话自管) */
  systemPrompt: string;
  /** piwork 侧 AgentTool(技能工具 + deliver_file),内部适配为 ToolDefinition */
  tools?: AgentTool[];
};

export type PiworkAgentSession = {
  /** 同步释放:abort agent/bash、失效扩展上下文;吞错以便 finally 无条件调用 */
  dispose: () => void;
  extensionsResult: LoadExtensionsResult;
  session: AgentSession;
};

function buildSessionEntries(cwd: string, messages: Message[]): FileEntry[] {
  const header: FileEntry = {
    cwd,
    id: `piwork-session-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    type: "session",
    version: CURRENT_SESSION_VERSION,
  };
  const entries: FileEntry[] = [header];
  let parentId = header.id;
  for (const [index, message] of messages.entries()) {
    const entry: FileEntry = {
      id: `piwork-h${index}`,
      message,
      parentId,
      timestamp: new Date(message.timestamp ?? Date.now()).toISOString(),
      type: "message",
    };
    entries.push(entry);
    parentId = entry.id;
  }
  return entries;
}

/**
 * 构建接入 pi 扩展运行时的聊天会话(Pi 1.0.0 SDK 形态,见
 * docs/architecture.md 第 10 节):
 * loader(模型桥 + 内置 MCP 扩展 + 受管 agentDir 扩展) → 显式 reload
 * → createAgentSession → bindExtensions(触发 session_start,内置 MCP
 * 扩展在后台连接受管 agentDir mcp.json 里的服务)。
 * 每请求新建:cwd 烧进 loader 的资源发现,聊天工作区互不相同,不能共享。
 */
export async function createPiworkAgentSession(
  options: PiworkAgentSessionOptions
): Promise<PiworkAgentSession> {
  const startedAt = Date.now();
  await ensureManagedAgentSettings();
  await retireLegacyMcpAdapterPackage();
  const providers = await getActivePiProviders();
  const modelRuntime = await ModelRuntime.create({
    credentials: createPluginCredentialStore(),
  });

  const settingsManager = options.disableImageAutoResize
    ? SettingsManager.inMemory({ images: { autoResize: false } })
    : undefined;
  const loader = new DefaultResourceLoader({
    ...(settingsManager ? { settingsManager } : {}),
    agentDir: MANAGED_AGENT_DIR,
    appendSystemPrompt: options.appendSystemPrompt,
    cwd: options.cwd,
    extensionFactories: [
      // 内置 MCP 扩展(pi.dev/docs/latest/mcp):服务来自受管 agentDir 的
      // mcp.json,exposure=direct 时工具像内建工具一样声明给模型。
      // session_start 由下方 bindExtensions 触发,服务在后台连接。
      ...(options.disableBuiltinTools
        ? []
        : [createMcpExtension({ loadConfig: () => loadPiworkMcpConfig() })]),
      ...providers.map((provider) => ({
        factory: (pi: ExtensionAPI) => {
          pi.registerProvider(provider);
        },
        hidden: true,
        name: `piwork-model-bridge-${provider.id}`,
      })),
    ],
    noContextFiles: true,
    // 工作区是隔离沙箱:AGENTS.md 等上下文文件不自动注入(与现状对齐)
    noExtensions: options.disableBuiltinTools ?? false,
    noPromptTemplates: true,
    // 切断 ~/.agents/skills 与 ~/.pi 全局技能泄漏;piwork 技能走自有管线
    noSkills: true,
    noThemes: true,
    systemPrompt: options.systemPrompt,
  });
  // 自带 loader 必须 reload:createAgentSession 只 reload 自建的,
  // 跳过则扩展静默为 0(E.4.1)
  await loader.reload();

  const { session, extensionsResult } = await createAgentSession({
    agentDir: MANAGED_AGENT_DIR,
    customTools: (options.tools ?? []).map(agentToolToToolDefinition),
    cwd: options.cwd,
    model: options.model,
    modelRuntime,
    // 轻量会话显式限制平台工具；执行会话保留扩展工具发现。
    ...(options.disableBuiltinTools
      ? {
          noTools: "builtin" as const,
          tools: (options.tools ?? []).map((tool) => tool.name),
        }
      : {}),
    resourceLoader: loader,
    ...(settingsManager ? { settingsManager } : {}),
    sessionManager: SessionManager.inMemory(
      options.cwd,
      undefined,
      buildSessionEntries(options.cwd, options.historyMessages)
    ),
  });

  // headless 必需:触发 session_start → 内置 MCP 扩展连接服务
  await session.bindExtensions({
    mode: "print",
    onError: (error) => {
      console.warn("[piwork-agent-session] extension error:", error);
    },
  });

  for (const { error, path } of extensionsResult.errors) {
    console.warn(
      `[piwork-agent-session] extension load failed (${path}):`,
      error
    );
  }
  if (process.env.NODE_ENV === "development") {
    console.info(
      `[piwork-agent-session] ready in ${Date.now() - startedAt}ms tools=%j`,
      session.getActiveToolNames()
    );
  }

  return {
    dispose: () => {
      try {
        session.dispose();
      } catch (error) {
        console.warn("[piwork-agent-session] dispose failed:", error);
      }
    },
    extensionsResult,
    session,
  };
}
