const MAX_SKILL_DISPLAY_NAME_LENGTH = 80;

export function formatSkillDisplayName(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function validateSkillDisplayName(displayName: string): string {
  const cleaned = displayName.trim();
  if (
    !cleaned ||
    cleaned.length > MAX_SKILL_DISPLAY_NAME_LENGTH ||
    /[\r\n]/.test(cleaned)
  ) {
    throw new Error(
      `Skill display name must be 1-${MAX_SKILL_DISPLAY_NAME_LENGTH} characters on one line.`
    );
  }
  return cleaned;
}

function parseYamlString(value: string): string | null {
  const cleaned = value.trim();
  if (!cleaned) {
    return null;
  }
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    try {
      const parsed = JSON.parse(cleaned);
      return typeof parsed === "string" ? parsed : null;
    } catch {
      return null;
    }
  }
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    return cleaned.slice(1, -1).replaceAll("''", "'");
  }
  return cleaned;
}

export function parseSkillDisplayName(metadata: string): string | null {
  let inInterface = false;

  for (const line of metadata.split(/\r?\n/)) {
    if (/^interface:\s*(?:#.*)?$/.test(line)) {
      inInterface = true;
      continue;
    }
    if (inInterface && line.trim() && !/^\s/.test(line)) {
      return null;
    }
    if (!inInterface) {
      continue;
    }

    const match = line.match(/^\s{2}display_name:\s*(.+?)\s*$/);
    if (match) {
      return parseYamlString(match[1]);
    }
  }

  return null;
}
