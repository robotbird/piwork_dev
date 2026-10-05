import type { ChatMessage } from "@/lib/types";

/** New user messages are always fresh turns. Old approval parts must never turn
 * a new request into a continuation, regardless of the server-selected backend.
 */
export function isChatApprovalContinuation(messages: readonly ChatMessage[]) {
  return messages.at(-1)?.role !== "user";
}
