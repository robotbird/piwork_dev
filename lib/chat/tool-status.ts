import type { TranslationParams } from "@/lib/i18n";

const LABEL_KEYS: Record<string, string> = {
  bash: "toolStatus.bash",
  create_skill: "toolStatus.create_skill",
  deliver_file: "toolStatus.deliver_file",
  edit: "toolStatus.edit",
  load_skill: "toolStatus.load_skill",
  mcp: "toolStatus.mcp",
  mcpScript: "toolStatus.mcpScript",
  platform_web_search: "toolStatus.platform_web_search",
  read: "toolStatus.read",
  write: "toolStatus.write",
};

export function toolStatusDetail(toolName: string, args?: unknown): string {
  const a = (args ?? {}) as Record<string, unknown>;
  if (toolName === "bash" && typeof a.command === "string") {
    return `: ${a.command.slice(0, 80)}`;
  }
  if (typeof a.path === "string") {
    return `: ${a.path}`;
  }
  if (toolName === "load_skill" && typeof a.name === "string") {
    return `: ${a.name}`;
  }
  return "";
}

/** Platform display only; tool identifiers and runtime events remain unchanged. */
export function formatToolStatus(
  phase: "start" | "end",
  toolName: string,
  args: unknown,
  isError: boolean,
  t: (key: string, params?: TranslationParams) => string,
  detail = toolStatusDetail(toolName, args)
): string {
  let label = LABEL_KEYS[toolName] ? t(LABEL_KEYS[toolName]) : toolName;
  if (toolName.startsWith("mcp__")) {
    const segments = toolName.split("__").slice(1);
    label = segments.length > 1 ? segments.join("/") : toolName;
  }
  return t(
    phase === "start"
      ? "toolStatus.started"
      : isError
        ? "toolStatus.failed"
        : "toolStatus.completed",
    { detail, label }
  );
}
