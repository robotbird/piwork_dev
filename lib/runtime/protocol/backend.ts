import type { RuntimeAck, RuntimeCommand } from "./commands";
import type { RuntimeEvent, RuntimeSnapshot } from "./events";
import type { RuntimeSpec } from "./spec";

/**
 * RuntimeBackend/RuntimeSession：平台驱动 Agent Runtime 的 seam（v2.0 §5.1）。
 * 生产目标态为 SandboxRpcBackend（Step 3–5）；开发、测试与迁移期为 InProcessBackend。
 */
export type RuntimeSession = {
  /** 命令受理即返回；完成由 events() 中的 run.settled/run.failed 表达 */
  send: (command: RuntimeCommand) => Promise<RuntimeAck>;
  /**
   * 事件流（单消费者）。Step 1 不实现 cursor 恢复，传入非空 cursor 抛错；
   * Step 2 引入持久游标后支持断线续传。
   */
  events: (cursor?: string) => AsyncIterable<RuntimeEvent>;
  snapshot: () => Promise<RuntimeSnapshot>;
  /** 幂等；释放底层会话资源 */
  close: (reason: string) => Promise<void>;
};

export type RuntimeBackend = {
  open: (spec: RuntimeSpec) => Promise<RuntimeSession>;
};
