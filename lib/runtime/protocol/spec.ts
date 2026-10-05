import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { Api, Message, Model } from "@earendil-works/pi-ai";

/**
 * RuntimeSpec：平台对一次 Agent Runtime 执行的完整声明（v2.0 §5.1）。
 * Step 1 形态：model/historyMessages/tools 暂保留 pi 原生类型——seam 在服务端内部；
 * 运行宿主内部继续保留这些类型；跨进程/持久化边界使用独立的 RunDescriptor，
 * 不向本类型继续添加附件字节或跨进程工具闭包（企业 MVP 方案 §2.1）。
 */
export type DurableChatAttachment = {
  libraryItemId: string;
  path: string;
  sha256: string;
  size: number;
};

export type RuntimeSpec = {
  /** Explicit request lane. Selection is not authorization. */
  lane?: "default" | "durable_sandbox";
  /** Server-assembled, reference-only grant; never accepted from request JSON. */
  durableChat?: {
    userId: string;
    catalogModelId: string;
    promptHash: string;
    attachments: DurableChatAttachment[];
  };
  /** Assigned by RunManager; shared with sandbox registry and inference audit. */
  runId?: string;
  /** 关联聊天；Step 2 起映射 AgentRun，Step 1 仅透传 */
  chatId: string;
  /** 聊天执行工作区；null = 关闭执行类工具（backend 派生 cwd 与 noTools builtin） */
  workspaceDir: string | null;
  // TODO(Step 3): RPC 序列化边界上换中性模型引用
  model: Model<Api>;
  /** 基础系统提示（替换 pi 默认 persona） */
  systemPrompt: string;
  /** 追加在会话系统提示之后的段落（skills 段 + 执行段） */
  appendSystemPrompt: string[];
  /** 既有对话（有损重建的文本消息） */
  historyMessages: Message[];
  /** 平台侧 AgentTool（技能工具）；deliver_file 由 backend 按 workspaceDir 注入 */
  tools: AgentTool[];
  /**
   * 本次运行申请的 egress FQDN 白名单（spec §6 Phase 4）。只能收紧：
   * backend 与装配基线取交集，申请超出基线的条目被丢弃；未设置 = 基线
   * （proxy 主机 + 装配级附加）。沙箱默认拒绝一切其余出站。
   */
  egress?: { allowFqdns: string[] };
};
