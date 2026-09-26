import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { Api, Message, Model } from "@earendil-works/pi-ai";

/**
 * RuntimeSpec：平台对一次 Agent Runtime 执行的完整声明（v2.0 §5.1）。
 * Step 1 形态：model/historyMessages/tools 暂保留 pi 原生类型——seam 在服务端内部；
 * Step 3 引入 RpcClient 时在序列化边界收敛为中性 DTO（模型引用 + 会话文件 seeding）。
 */
export type RuntimeSpec = {
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
};
