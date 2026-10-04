import "server-only";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import type { Harness } from "@earendil-works/pi-durable";

/** Must run before resume/submit/wait (all can start the official scheduler).
 * No generic shell/business tool is replay-safe in the platform adapter.
 * This rejects uncertain intent AND already materialized interrupted results,
 * rather than letting a subsequent model answer turn the job into success.
 */
export async function assertDurableRecoverySafe(
  harness: Harness
): Promise<void> {
  const inspection = await harness.inspect(BACKGROUND_CONTEXT);
  for (const task of inspection.tasks) {
    const { record } = task;
    if (
      record.kind === "pi.tool" &&
      "checkpoint" in record.state &&
      typeof record.state.checkpoint === "object" &&
      record.state.checkpoint !== null &&
      !Array.isArray(record.state.checkpoint) &&
      record.state.checkpoint.phase === "execute"
    ) {
      throw new Error("runtime:durable:needs-review:interrupted-tool-intent");
    }
  }
  const conversation = await harness.root(BACKGROUND_CONTEXT);
  const context = await conversation.context(BACKGROUND_CONTEXT);
  for (const entry of context.entries) {
    if (
      entry.kind !== "pi.tool-result" ||
      typeof entry.data !== "object" ||
      entry.data === null ||
      Array.isArray(entry.data)
    ) {
      continue;
    }
    const { diagnostics } = entry.data;
    if (
      Array.isArray(diagnostics) &&
      diagnostics.some(
        (diagnostic) =>
          typeof diagnostic === "object" &&
          diagnostic !== null &&
          !Array.isArray(diagnostic) &&
          ["interrupted", "tool_error", "aborted"].includes(
            String(diagnostic.code)
          )
      )
    ) {
      throw new Error("runtime:durable:needs-review:uncertain-tool-result");
    }
  }
}
