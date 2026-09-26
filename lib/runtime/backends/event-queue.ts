import type { RuntimeEvent } from "../protocol";

/**
 * 单消费者异步事件队列：push 即缓冲，iterate 按序消费；end() 唤醒并终止迭代。
 * Step 1 仅保证 InProcess/InMemory backend 的事件不丢、不乱序；
 * 广播与按 cursor 重放属于 Step 2（AgentRun + 事件游标）。
 */
export class AsyncEventQueue {
  private readonly buffer: RuntimeEvent[] = [];
  private readonly waiters: Array<() => void> = [];
  private ended = false;

  /** close 之后到达的事件直接丢弃（终态已发，语义完整） */
  push(event: RuntimeEvent): void {
    if (this.ended) {
      return;
    }
    this.buffer.push(event);
    this.drainWaiters();
  }

  end(): void {
    this.ended = true;
    this.drainWaiters();
  }

  private drainWaiters(): void {
    for (const wake of this.waiters.splice(0)) {
      wake();
    }
  }

  async *iterate(): AsyncIterable<RuntimeEvent> {
    for (;;) {
      while (this.buffer.length > 0) {
        yield this.buffer.shift() as RuntimeEvent;
      }
      if (this.ended) {
        return;
      }
      // biome-ignore lint/performance/noAwaitInLoops: 异步生成器的等待点，非循环内串行 IO
      await new Promise<void>((resolve) => {
        this.waiters.push(resolve);
      });
    }
  }
}
