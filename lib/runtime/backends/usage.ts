import type { RuntimeUsage } from "../protocol/events";

/** Preserve Pi's reported total; reasoning is already included in output. */
export function normalizeUsage(
  usage: RuntimeUsage | undefined
): RuntimeUsage | undefined {
  if (!usage) {
    return;
  }
  const { input, output, cacheRead, cacheWrite, totalTokens } = usage;
  if (
    ![input, output, cacheRead, cacheWrite, totalTokens].every(
      (value) => Number.isSafeInteger(value) && value >= 0
    )
  ) {
    return;
  }
  return { cacheRead, cacheWrite, input, output, totalTokens };
}
