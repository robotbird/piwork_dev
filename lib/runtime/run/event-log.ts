import type { RuntimeEvent } from "../protocol";

/** 日志条目：index 为全序下标（数组下标）；seq 仅持久事件携带 */
export type LoggedRuntimeEvent = {
  index: number;
  event: RuntimeEvent;
  seq?: number;
};

export type AppendLogInput = Omit<LoggedRuntimeEvent, "index">;

/**
 * per-run 内存全量事件日志（含 message.delta，v2.0 §8.2 直传部分）。
 * attach 的原子快照基础：Node 单线程下"订阅者入集合 + 取 watermark =
 * log.length"在同一同步块完成，slice 纯内存读，不丢不重。
 */
export class RunEventLog {
  private readonly entries: LoggedRuntimeEvent[] = [];

  get length(): number {
    return this.entries.length;
  }

  append(input: AppendLogInput): LoggedRuntimeEvent {
    const entry: LoggedRuntimeEvent = { ...input, index: this.entries.length };
    this.entries.push(entry);
    return entry;
  }

  /** [from, to) 区间快照（浅拷贝条目，防订阅方改写日志） */
  slice(from: number, to: number): LoggedRuntimeEvent[] {
    return this.entries.slice(from, to).map((entry) => ({ ...entry }));
  }

  /** 最后一个持久事件的 seq；无持久事件 → 0 */
  latestSeq(): number {
    for (let i = this.entries.length - 1; i >= 0; i -= 1) {
      const seq = this.entries[i]?.seq;
      if (seq !== undefined) {
        return seq;
      }
    }
    return 0;
  }

  /**
   * cursor 的重放起点：最后一个 seq ≤ cursor 的条目之后的位置。
   * cursor=0 → 0（全量）；delta 无 seq、随其前后的持久事件相对位置取舍——
   * 客户端确认到 seq N 即已渲染 N 之前的全部 delta，重放从 N 之后接续。
   */
  indexAfterSeq(cursor: number): number {
    let from = 0;
    for (const entry of this.entries) {
      if (entry.seq !== undefined && entry.seq <= cursor) {
        from = entry.index + 1;
      }
    }
    return from;
  }
}
