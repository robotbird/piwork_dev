import { LocalizedError, translateMessage } from "@/lib/i18n/messages";
import type { RunHandle } from "@/lib/runtime/run/run-manager";

export async function waitForTaskCompletion(
  handle: RunHandle,
  timeoutMs = 300_000
) {
  const subscription = handle.attach();
  if (!subscription) {
    throw new LocalizedError("runtimeMessages.subscriptionFailed");
  }
  // The scheduler only needs the completion promise, not an unbounded event queue.
  subscription.close();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const outcome = await Promise.race([
      subscription.settled,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new LocalizedError("runtimeMessages.taskTimeout")),
          timeoutMs
        );
      }),
    ]);
    if (outcome !== "settled") {
      throw new Error(
        outcome === "aborted"
          ? translateMessage("runtimeMessages.taskStopped")
          : translateMessage("runtimeMessages.taskFailed")
      );
    }
  } finally {
    clearTimeout(timer);
  }
}
