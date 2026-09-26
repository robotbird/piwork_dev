import type { ImageContent } from "@earendil-works/pi-ai";

/**
 * RuntimeCommand 首版命令集（v2.0 §5.1）：prompt/steer/followUp/abort/clearQueue。
 * InProcessBackend 对 steer/followUp/clearQueue 直通 AgentSession 原生实现；
 * fork/compact 等 pi 能力暂留 adapter 内，出现产品调用方后再扩充公共接口。
 */
export type RuntimeCommand =
  | {
      type: "prompt";
      text: string;
      images?: ImageContent[];
      /** 默认 false：技能命令已平台侧展开，避免 /mcp 等前缀派发扩展命令 */
      expandPromptTemplates?: boolean;
    }
  | { type: "steer"; text: string; images?: ImageContent[] }
  | { type: "followUp"; text: string; images?: ImageContent[] }
  | { type: "abort" }
  | { type: "clearQueue" };

/** Ack = 命令受理；执行进度一律通过 events() 的 run.* 事件表达 */
export type RuntimeAck = { ok: true } | { ok: false; error: string };
