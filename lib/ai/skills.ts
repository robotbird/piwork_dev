import {
  type AgentTool,
  formatSkillInvocation,
  formatSkillsForSystemPrompt,
  loadSkills,
  type Skill,
} from "@earendil-works/pi-agent-core";
import { NodeExecutionEnv } from "@earendil-works/pi-agent-core/node";
import { Type } from "@earendil-works/pi-ai";
import {
  formatSkillDisplayName,
  parseSkillDisplayName,
  validateSkillDisplayName,
} from "./skill-display";

const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_INSTRUCTIONS_LENGTH = 50_000;
const RESERVED_SKILL_NAMES = new Set([
  "clear",
  "delete",
  "model",
  "new",
  "purge",
  "rename",
  "theme",
]);

function getSkillsDirectory(cwd: string) {
  return `${cwd}/.pi/skills`;
}

function createExecutionEnv(cwd: string) {
  return new NodeExecutionEnv({ cwd });
}

export function validateSkillName(name: string) {
  if (name.length > 64 || !SKILL_NAME_PATTERN.test(name)) {
    throw new Error(
      "Skill name must be 1-64 characters using lowercase letters, numbers, and single hyphens only."
    );
  }
  if (RESERVED_SKILL_NAMES.has(name)) {
    throw new Error(`Skill name "${name}" conflicts with a built-in command.`);
  }
}

export async function loadProjectSkills(cwd = process.cwd()) {
  const env = createExecutionEnv(cwd);

  try {
    return await loadSkills(env, getSkillsDirectory(cwd));
  } finally {
    await env.cleanup();
  }
}

export async function loadProjectSkillSummaries(cwd = process.cwd()) {
  const env = createExecutionEnv(cwd);

  try {
    const loaded = await loadSkills(env, getSkillsDirectory(cwd));
    const skills = await Promise.all(
      loaded.skills.map(async (skill) => {
        const metadataPath = skill.filePath.replace(
          /SKILL\.md$/,
          "agents/openai.yaml"
        );
        const metadata = await env.readTextFile(metadataPath);
        const configuredName = metadata.ok
          ? parseSkillDisplayName(metadata.value)
          : null;

        return {
          description: skill.description,
          displayName: configuredName?.trim()
            ? configuredName.trim()
            : formatSkillDisplayName(skill.name),
          name: skill.name,
        };
      })
    );

    return { diagnostics: loaded.diagnostics, skills };
  } finally {
    await env.cleanup();
  }
}

export async function createProjectSkill({
  name,
  displayName,
  description,
  instructions,
  cwd = process.cwd(),
}: {
  name: string;
  displayName?: string;
  description: string;
  instructions: string;
  cwd?: string;
}) {
  validateSkillName(name);

  const cleanDescription = description.trim();
  const cleanInstructions = instructions.trim();
  const cleanDisplayName = validateSkillDisplayName(
    displayName ?? formatSkillDisplayName(name)
  );

  if (!cleanDescription || cleanDescription.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(
      `Skill description must be 1-${MAX_DESCRIPTION_LENGTH} characters.`
    );
  }
  if (
    !cleanInstructions ||
    cleanInstructions.length > MAX_INSTRUCTIONS_LENGTH
  ) {
    throw new Error(
      `Skill instructions must be 1-${MAX_INSTRUCTIONS_LENGTH} characters.`
    );
  }

  const env = createExecutionEnv(cwd);
  const skillDirectory = `${getSkillsDirectory(cwd)}/${name}`;
  const skillPath = `${skillDirectory}/SKILL.md`;

  try {
    const existing = await env.exists(skillPath);
    if (!existing.ok) {
      throw existing.error;
    }
    if (existing.value) {
      throw new Error(`Skill "${name}" already exists.`);
    }

    const created = await env.createDir(skillDirectory, { recursive: true });
    if (!created.ok) {
      throw created.error;
    }

    const agentsDirectory = `${skillDirectory}/agents`;
    const agentsCreated = await env.createDir(agentsDirectory, {
      recursive: true,
    });
    if (!agentsCreated.ok) {
      throw agentsCreated.error;
    }

    const metadata = [
      "interface:",
      `  display_name: ${JSON.stringify(cleanDisplayName)}`,
      "",
    ].join("\n");
    const metadataWritten = await env.writeFile(
      `${agentsDirectory}/openai.yaml`,
      metadata
    );
    if (!metadataWritten.ok) {
      throw metadataWritten.error;
    }

    const content = [
      "---",
      `name: ${JSON.stringify(name)}`,
      `description: ${JSON.stringify(cleanDescription)}`,
      "---",
      "",
      cleanInstructions,
      "",
    ].join("\n");
    const written = await env.writeFile(skillPath, content);
    if (!written.ok) {
      throw written.error;
    }

    const loaded = await loadSkills(env, skillDirectory);
    const skill = loaded.skills.find((candidate) => candidate.name === name);
    if (!skill) {
      const detail = loaded.diagnostics.map((item) => item.message).join("; ");
      throw new Error(detail || `Skill "${name}" failed validation.`);
    }

    return skill;
  } finally {
    await env.cleanup();
  }
}

export function buildSkillsSystemPrompt(skills: Skill[]) {
  const availableSkills = formatSkillsForSystemPrompt(skills);

  return [
    "Skills are reusable, on-demand instruction packages.",
    "When a request matches an available skill, call load_skill before answering and follow the returned instructions.",
    "When the user asks to create a reusable skill, call create_skill with complete, actionable Markdown instructions.",
    availableSkills,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function parseSkillCommand(input: string) {
  const match = input.trim().match(/^\/([a-z0-9-]+)(?:\s+([\s\S]+))?$/);
  if (!match) {
    return null;
  }

  return { instructions: match[2]?.trim(), name: match[1] };
}

export function invokeSkill(
  skills: Skill[],
  name: string,
  additionalInstructions?: string
) {
  const skill = skills.find((candidate) => candidate.name === name);
  if (!skill) {
    throw new Error(`Unknown skill "${name}".`);
  }

  return formatSkillInvocation(skill, additionalInstructions);
}

export function createSkillTools(
  initialSkills: Skill[],
  cwd = process.cwd()
): AgentTool[] {
  const skills = new Map(initialSkills.map((skill) => [skill.name, skill]));

  const loadSkill: AgentTool = {
    description:
      "Load the complete instructions for an available skill before carrying out a matching task.",
    execute: (_toolCallId, params) => {
      const { name, task } = params as { name: string; task?: string };
      const skill = skills.get(name);
      if (!skill) {
        throw new Error(`Unknown skill "${name}".`);
      }

      return Promise.resolve({
        content: [
          {
            text: formatSkillInvocation(skill, task),
            type: "text",
          },
        ],
        details: { name: skill.name, path: skill.filePath },
      });
    },
    label: "Load skill",
    name: "load_skill",
    parameters: Type.Object({
      name: Type.String({ description: "Exact name of the skill to load" }),
      task: Type.Optional(
        Type.String({
          description: "The user's task or arguments to execute with the skill",
        })
      ),
    }),
  };

  const createSkill: AgentTool = {
    description:
      "Create a reusable project skill in the standard .pi/skills/<name>/SKILL.md format. Use only when the user asks to create or save a skill.",
    execute: async (_toolCallId, params) => {
      const skill = await createProjectSkill({
        ...(params as {
          name: string;
          displayName?: string;
          description: string;
          instructions: string;
        }),
        cwd,
      });
      skills.set(skill.name, skill);

      return {
        content: [
          {
            text: `Created skill "${skill.name}" at ${skill.filePath}. It is ready to use with /${skill.name}.`,
            type: "text",
          },
        ],
        details: { name: skill.name, path: skill.filePath },
      };
    },
    executionMode: "sequential",
    label: "Create skill",
    name: "create_skill",
    parameters: Type.Object({
      description: Type.String({
        description:
          "Specific description of what the skill does and when it should be used",
      }),
      displayName: Type.Optional(
        Type.String({
          description:
            "Human-friendly title shown in the chat UI, such as Weekly Report. Defaults to a title-cased skill name.",
        })
      ),
      instructions: Type.String({
        description:
          "Complete Markdown workflow, including constraints, steps, expected outputs, and relative references when needed",
      }),
      name: Type.String({
        description:
          "Skill name: lowercase letters, numbers and single hyphens, maximum 64 characters",
      }),
    }),
  };

  return [loadSkill, createSkill];
}
