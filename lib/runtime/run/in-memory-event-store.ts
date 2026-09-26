import type { EventStore, PersistedRuntimeEvent } from "./event-store";

/** 封闭测试用内存实现；幂等与重放语义与 PostgresEventStore 保持一致 */
export class InMemoryEventStore implements EventStore {
  private readonly events = new Map<string, PersistedRuntimeEvent[]>();

  // biome-ignore lint/suspicious/useAwait: 接口契约要求返回 Promise，内存实现无真实异步工作
  async append(event: PersistedRuntimeEvent): Promise<void> {
    const list = this.events.get(event.runId) ?? [];
    // (runId, seq) 冲突静默忽略——与 PG onConflictDoNothing 语义一致
    if (list.some((existing) => existing.seq === event.seq)) {
      return;
    }
    list.push({ ...event });
    list.sort((a, b) => a.seq - b.seq);
    this.events.set(event.runId, list);
  }

  // biome-ignore lint/suspicious/useAwait: 接口契约要求返回 Promise，内存实现无真实异步工作
  async replay(
    runId: string,
    afterSeq: number
  ): Promise<PersistedRuntimeEvent[]> {
    return (this.events.get(runId) ?? [])
      .filter((event) => event.seq > afterSeq)
      .map((event) => ({ ...event }));
  }

  // biome-ignore lint/suspicious/useAwait: 接口契约要求返回 Promise，内存实现无真实异步工作
  async latestSeq(runId: string): Promise<number> {
    const list = this.events.get(runId) ?? [];
    return list.at(-1)?.seq ?? 0;
  }
}
