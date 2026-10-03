import "server-only";

/**
 * Inference Proxy（spec §6 Phase 4）：沙箱内 pi 的唯一模型入口。
 * 模块边界：只依赖 pi-ai 官方类型与 node 内建；不 import backends/
 * sandbox/lib-ai（上游经 UpstreamResolver 注入，审计经 sink 注入）。
 */

export { toPiMessagesEvent } from "./events";
export {
  buildSandboxModelsJson,
  RUN_TOKEN_ENV,
  type SandboxModelEntry,
  sandboxModelEntryFromModel,
} from "./models-manifest";
export {
  DEFAULT_MAX_BODY_BYTES,
  type InferenceAuditEntry,
  type InferenceAuditSink,
  InferenceProxyServer,
  type UpstreamModel,
  type UpstreamResolver,
} from "./server";
export {
  DEFAULT_RUN_TOKEN_TTL_MS,
  type RunModelGrant,
  type RunTokenGrant,
  RunTokenRegistry,
} from "./tokens";
