import type { ChatMessage } from "../../../types";

const PLATFORM_REQUEST =
  /\b(mcp|skills?|plugins?|packages?|browse|search|fetch|scheduled?|remind)\b|技能|插件|联网|浏览器|搜索|检索|定时|提醒|计划任务|每天|每周|每月/i;
const SANDBOX_TOOLS = new Set([
  "read",
  "write",
  "edit",
  "bash",
  "deliver_file",
]);

/** Conservative heuristic capability guard, not authorization or proof of intent.
 * Retains compatibility for named integrations and recent platform-tool calls.
 */
export function chatNeedsCompatibility(input: {
  message: string;
  history: readonly ChatMessage[];
  capabilityNames: readonly string[];
}): boolean {
  const recent = input.history.slice(-2);
  const text = [
    input.message,
    ...recent.flatMap((message) =>
      message.parts.flatMap((part) => (part.type === "text" ? [part.text] : []))
    ),
  ]
    .join("\n")
    .toLowerCase();
  return (
    PLATFORM_REQUEST.test(text) ||
    input.capabilityNames.some(
      (name) => name.trim().length > 0 && text.includes(name.toLowerCase())
    ) ||
    recent.some((message) =>
      message.parts.some((part) => {
        const { type } = part;
        const name =
          type === "dynamic-tool" && "toolName" in part
            ? String(part.toolName)
            : type.startsWith("tool-")
              ? type.slice(5)
              : undefined;
        return name !== undefined && !SANDBOX_TOOLS.has(name);
      })
    )
  );
}

/** Select once, before attachment parsing/workspace creation. No error fallback. */
export function selectChatRuntime(input: {
  durableEnabled: boolean;
  requiresExecution: boolean;
  classificationReason: string;
  approvalContinuation: boolean;
  skillCommand: boolean;
  needsCompatibility: boolean;
}): { lane: "default" | "durable_sandbox"; reason: string } {
  if (
    input.approvalContinuation ||
    input.skillCommand ||
    input.needsCompatibility
  ) {
    return { lane: "default", reason: "platform-compatibility" };
  }
  if (!input.requiresExecution) {
    return { lane: "default", reason: "lightweight" };
  }
  if (["uncertain", "unavailable"].includes(input.classificationReason)) {
    return { lane: "default", reason: "uncertain-capabilities" };
  }
  return input.durableEnabled
    ? { lane: "durable_sandbox", reason: "automatic-sandbox-tools" }
    : { lane: "default", reason: "durable-disabled" };
}
