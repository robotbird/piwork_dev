import type { RunHandle } from "@/lib/runtime/run/run-manager";

export async function waitForTaskCompletion(
  handle: RunHandle,
  timeoutMs = 300_000
) {
  const subscription = handle.attach();
  if (!subscription) {
    throw new Error("无法订阅任务运行");
  }
  // The scheduler only needs the completion promise, not an unbounded event queue.
  subscription.close();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const outcome = await Promise.race([
      subscription.settled,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("任务执行超时，已停止")),
          timeoutMs
        );
      }),
    ]);
    if (outcome !== "settled") {
      throw new Error(
        outcome === "aborted" ? "任务已停止" : "AI 执行失败，请查看运行对话"
      );
    }
  } finally {
    clearTimeout(timer);
  }
}
