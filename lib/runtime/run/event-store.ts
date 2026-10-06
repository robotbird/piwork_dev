import type { RuntimeEvent } from "../protocol";

/**
 * 持久化的关键 RuntimeEvent（v2.0 §8.2）：带 (runId, seq) 单调游标序。
 * data 为去掉 type 与 runId 冗余后的事件负载，供审计与 Step 8 跨进程重放。
 */
export type PersistedRuntimeEvent = {
  runId: string;
  seq: number;
  type: string;
  data: Record<string, unknown>;
  createdAt?: Date;
};

/**
 * 事件持久化端口：Postgres 实现落 RuntimeEvent 表（lib/db），内存实现供
 * node:test 封闭测试——两实现跑同一套契约用例（Step 1 的 double 模式）。
 */
export interface EventStore {
  /** 幂等：(runId, seq) 冲突静默忽略——“重复事件不重复落库”的载体 */
  append: (event: PersistedRuntimeEvent) => Promise<void>;
  /** 无事件返回 0 */
  latestSeq: (runId: string) => Promise<number>;
  /** seq 升序返回 seq > afterSeq 的事件 */
  replay: (runId: string, afterSeq: number) => Promise<PersistedRuntimeEvent[]>;
}

/**
 * 落库白名单（v2.0 §8.2）：状态、工具、Artifact、错误等关键事件；
 * message.delta 经进程内 SSE 直传不入库（message 完成时随消息落库）。
 */
const PERSISTED_EVENT_TYPES: ReadonlySet<string> = new Set([
  "run.started",
  "run.settled",
  "run.failed",
  "tool.started",
  "tool.completed",
  "artifact.created",
  "source.created",
  "message.completed",
]);

export function isPersistedRuntimeEvent(event: RuntimeEvent): boolean {
  return PERSISTED_EVENT_TYPES.has(event.type);
}

/** 事件负载 = 事件去掉 type 与 runId 后的字段（无 runId 的事件去掉 type 即可） */
export function runtimeEventData(event: RuntimeEvent): Record<string, unknown> {
  if ("runId" in event) {
    const { runId: _runId, type: _type, ...data } = event;
    return data;
  }
  const { type: _type, ...data } = event;
  return data;
}
