import { dirname, extname, isAbsolute, relative, resolve } from "node:path";

import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import {
  formatSkillsForPrompt,
  loadSkillsFromDir,
  type Skill,
  stripFrontmatter,
} from "@earendil-works/pi-coding-agent";
import { NodeExecutionEnv } from "@earendil-works/pi-durable/env/node";
import { unzipSync } from "fflate";
import { getInstallableCatalogSkill } from "./skill-catalog";
import {
  formatSkillDisplayName,
  parseSkillDisplayName,
  parseSkillVersion,
  validateSkillDisplayName,
} from "./skill-display";

const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_INSTRUCTIONS_LENGTH = 50_000;
export const MAX_SKILL_UPLOAD_FILE_COUNT = 200;
export const MAX_SKILL_UPLOAD_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_SKILL_UPLOAD_TOTAL_SIZE = 15 * 1024 * 1024;
export const MAX_SKILL_FILE_ENTRY_COUNT = 500;
export const MAX_SKILL_PREVIEW_FILE_SIZE = 1024 * 1024;
const MAX_SKILL_PREVIEW_TEXT_LENGTH = 200_000;
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

function getSkillStatePath(cwd: string) {
  return `${cwd}/.pi/skill-state.json`;
}

function createExecutionEnv(cwd: string) {
  return new NodeExecutionEnv({ cwd });
}

export type ProjectSkillUploadFile = {
  content: Uint8Array;
  path: string;
};

function normalizeUploadPath(path: string) {
  const normalized = path.replaceAll("\\", "/");
  const segments = normalized.split("/");

  if (
    !normalized ||
    normalized.startsWith("/") ||
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\0")
    )
  ) {
    throw new Error(`Invalid upload path: ${path}`);
  }

  return segments.join("/");
}

function isIgnoredZipEntry(path: string) {
  const normalized = path.replaceAll("\\", "/");
  return (
    normalized.endsWith("/") ||
    normalized.startsWith("__MACOSX/") ||
    normalized.split("/").at(-1) === ".DS_Store"
  );
}

export function extractProjectSkillArchive({
  content,
  filename,
}: {
  content: Uint8Array;
  filename: string;
}): ProjectSkillUploadFile[] {
  if (!filename.toLocaleLowerCase().endsWith(".zip")) {
    throw new Error("Skill archive must be a .zip file.");
  }
  if (content.byteLength > MAX_SKILL_UPLOAD_TOTAL_SIZE) {
    throw new Error("The ZIP file exceeds the 15 MB upload limit.");
  }

  let fileCount = 0;
  let declaredTotalSize = 0;
  const archive = unzipSync(content, {
    filter(entry) {
      if (isIgnoredZipEntry(entry.name)) {
        return false;
      }

      normalizeUploadPath(entry.name);
      fileCount += 1;
      declaredTotalSize += entry.originalSize;

      if (fileCount > MAX_SKILL_UPLOAD_FILE_COUNT) {
        throw new Error(
          `A skill can contain at most ${MAX_SKILL_UPLOAD_FILE_COUNT} files.`
        );
      }
      if (entry.originalSize > MAX_SKILL_UPLOAD_FILE_SIZE) {
        throw new Error(`File "${entry.name}" exceeds the 5 MB limit.`);
      }
      if (declaredTotalSize > MAX_SKILL_UPLOAD_TOTAL_SIZE) {
        throw new Error("The extracted skill exceeds the 15 MB total limit.");
      }

      return true;
    },
  });

  let actualTotalSize = 0;
  let files = Object.entries(archive).map(([path, fileContent]) => {
    actualTotalSize += fileContent.byteLength;
    return { content: fileContent, path: normalizeUploadPath(path) };
  });
  if (files.length === 0) {
    throw new Error("The ZIP archive does not contain any skill files.");
  }
  if (actualTotalSize > MAX_SKILL_UPLOAD_TOTAL_SIZE) {
    throw new Error("The extracted skill exceeds the 15 MB total limit.");
  }

  const manifests = files.filter(
    (file) => file.path.split("/").at(-1) === "SKILL.md"
  );
  if (manifests.length === 1 && manifests[0].path === "SKILL.md") {
    const archiveRoot = filename.slice(0, -4);
    validateSkillName(archiveRoot);
    files = files.map((file) => ({
      ...file,
      path: `${archiveRoot}/${file.path}`,
    }));
  }

  return files;
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

export type ProjectSkillSource = "catalog" | "pi-package" | "upload";

export type ProjectSkillSummary = {
  description: string;
  displayName: string;
  enabled: boolean;
  name: string;
  source: ProjectSkillSource;
  version: string;
};

async function readDisabledSkillNames(env: NodeExecutionEnv, cwd: string) {
  const stateFile = await env.readTextFile(
    getSkillStatePath(cwd),
    BACKGROUND_CONTEXT
  );
  if (!stateFile.ok) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(stateFile.value) as { disabled?: unknown };
    return new Set(
      Array.isArray(parsed.disabled)
        ? parsed.disabled.filter(
            (name): name is string => typeof name === "string"
          )
        : []
    );
  } catch {
    return new Set<string>();
  }
}

async function writeDisabledSkillNames(
  env: NodeExecutionEnv,
  cwd: string,
  disabled: Set<string>
) {
  await env.createDir(`${cwd}/.pi`, { recursive: true }, BACKGROUND_CONTEXT);
  const written = await env.writeFile(
    getSkillStatePath(cwd),
    `${JSON.stringify({ disabled: [...disabled].sort() }, null, 2)}\n`,
    BACKGROUND_CONTEXT
  );
  if (!written.ok) {
    throw written.error;
  }
}

export async function loadProjectSkills(cwd = process.cwd()) {
  const env = createExecutionEnv(cwd);

  try {
    const loaded = loadSkillsFromDir({
      dir: getSkillsDirectory(cwd),
      source: "piwork",
    });
    const disabled = await readDisabledSkillNames(env, cwd);
    return {
      diagnostics: loaded.diagnostics,
      skills: loaded.skills.filter((skill) => !disabled.has(skill.name)),
    };
  } finally {
    await env.cleanup(BACKGROUND_CONTEXT);
  }
}

export async function loadAllProjectSkills(cwd = process.cwd()) {
  const env = createExecutionEnv(cwd);

  try {
    return loadSkillsFromDir({
      dir: getSkillsDirectory(cwd),
      source: "piwork",
    });
  } finally {
    await env.cleanup(BACKGROUND_CONTEXT);
  }
}

export async function loadProjectSkillSummaries(cwd = process.cwd()) {
  const env = createExecutionEnv(cwd);

  try {
    const loaded = loadSkillsFromDir({
      dir: getSkillsDirectory(cwd),
      source: "piwork",
    });
    const disabled = await readDisabledSkillNames(env, cwd);
    const skills = await Promise.all(
      loaded.skills.map(async (skill) => {
        const metadataPath = skill.filePath.replace(
          /SKILL\.md$/,
          "agents/openai.yaml"
        );
        const [metadata, skillFile] = await Promise.all([
          env.readTextFile(metadataPath, BACKGROUND_CONTEXT),
          env.readTextFile(skill.filePath, BACKGROUND_CONTEXT),
        ]);
        const configuredName = metadata.ok
          ? parseSkillDisplayName(metadata.value)
          : null;

        return {
          description: skill.description,
          displayName: configuredName?.trim()
            ? configuredName.trim()
            : formatSkillDisplayName(skill.name),
          enabled: !disabled.has(skill.name),
          name: skill.name,
          source: getInstallableCatalogSkill(skill.name)
            ? ("catalog" as const)
            : ("upload" as const),
          version: skillFile.ok
            ? (parseSkillVersion(skillFile.value) ?? "")
            : "",
        };
      })
    );

    return { diagnostics: loaded.diagnostics, skills };
  } finally {
    await env.cleanup(BACKGROUND_CONTEXT);
  }
}

export async function setProjectSkillEnabled(
  name: string,
  enabled: boolean,
  cwd = process.cwd()
) {
  validateSkillName(name);
  const env = createExecutionEnv(cwd);

  try {
    const loaded = loadSkillsFromDir({
      dir: getSkillsDirectory(cwd),
      source: "piwork",
    });
    const skill = loaded.skills.find((candidate) => candidate.name === name);
    if (!skill) {
      throw new Error(`Skill "${name}" was not found.`);
    }

    const disabled = await readDisabledSkillNames(env, cwd);
    if (enabled) {
      disabled.delete(name);
    } else {
      disabled.add(name);
    }
    await writeDisabledSkillNames(env, cwd, disabled);
  } finally {
    await env.cleanup(BACKGROUND_CONTEXT);
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
    const existing = await env.exists(skillPath, BACKGROUND_CONTEXT);
    if (!existing.ok) {
      throw existing.error;
    }
    if (existing.value) {
      throw new Error(`Skill "${name}" already exists.`);
    }

    const created = await env.createDir(
      skillDirectory,
      { recursive: true },
      BACKGROUND_CONTEXT
    );
    if (!created.ok) {
      throw created.error;
    }

    const agentsDirectory = `${skillDirectory}/agents`;
    const agentsCreated = await env.createDir(
      agentsDirectory,
      { recursive: true },
      BACKGROUND_CONTEXT
    );
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
      metadata,
      BACKGROUND_CONTEXT
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
    const written = await env.writeFile(skillPath, content, BACKGROUND_CONTEXT);
    if (!written.ok) {
      throw written.error;
    }

    const loaded = loadSkillsFromDir({ dir: skillDirectory, source: "piwork" });
    const skill = loaded.skills.find((candidate) => candidate.name === name);
    if (!skill) {
      const detail = loaded.diagnostics.map((item) => item.message).join("; ");
      throw new Error(detail || `Skill "${name}" failed validation.`);
    }

    return skill;
  } finally {
    await env.cleanup(BACKGROUND_CONTEXT);
  }
}

export async function installProjectSkill({
  files,
  cwd = process.cwd(),
}: {
  files: ProjectSkillUploadFile[];
  cwd?: string;
}) {
  if (files.length === 0) {
    throw new Error("Choose a skill folder to upload.");
  }

  const normalizedFiles = files.map((file) => ({
    ...file,
    path: normalizeUploadPath(file.path),
  }));
  const skillManifests = normalizedFiles.filter(
    (file) => file.path.split("/").at(-1) === "SKILL.md"
  );

  if (skillManifests.length !== 1) {
    throw new Error("An upload must contain exactly one SKILL.md file.");
  }

  const manifestSegments = skillManifests[0].path.split("/");
  if (manifestSegments.length !== 2) {
    throw new Error(
      "SKILL.md must be at the root of the selected skill folder."
    );
  }
  const uploadedRoot = manifestSegments.slice(0, -1).join("/");
  validateSkillName(uploadedRoot);
  const relativeFiles = normalizedFiles.map((file) => {
    if (uploadedRoot && !file.path.startsWith(`${uploadedRoot}/`)) {
      throw new Error(
        "All uploaded files must belong to the same skill folder."
      );
    }

    return {
      content: file.content,
      path: uploadedRoot ? file.path.slice(uploadedRoot.length + 1) : file.path,
    };
  });
  const uniquePaths = new Set(relativeFiles.map((file) => file.path));
  if (uniquePaths.size !== relativeFiles.length) {
    throw new Error("The upload contains duplicate file paths.");
  }

  const env = createExecutionEnv(cwd);
  const tempResult = await env.createTempDir(
    "piwork-skill-upload-",
    BACKGROUND_CONTEXT
  );
  if (!tempResult.ok) {
    await env.cleanup(BACKGROUND_CONTEXT);
    throw tempResult.error;
  }
  const stagingDirectory = tempResult.value;
  const stagedSkillDirectory = `${stagingDirectory}/${uploadedRoot}`;
  let installedDirectory: string | null = null;

  try {
    const stagedWrites = await Promise.all(
      relativeFiles.map((file) =>
        env.writeFile(
          `${stagedSkillDirectory}/${file.path}`,
          file.content,
          BACKGROUND_CONTEXT
        )
      )
    );
    const failedStagedWrite = stagedWrites.find((result) => !result.ok);
    if (failedStagedWrite && !failedStagedWrite.ok) {
      throw failedStagedWrite.error;
    }

    const staged = loadSkillsFromDir({
      dir: stagedSkillDirectory,
      source: "piwork",
    });
    if (staged.skills.length !== 1 || staged.diagnostics.length > 0) {
      const detail = staged.diagnostics.map((item) => item.message).join("; ");
      throw new Error(
        detail || "The uploaded skill could not be validated by Pi."
      );
    }

    const [skill] = staged.skills;
    validateSkillName(skill.name);
    installedDirectory = `${getSkillsDirectory(cwd)}/${skill.name}`;

    const existing = await env.exists(installedDirectory, BACKGROUND_CONTEXT);
    if (!existing.ok) {
      throw existing.error;
    }
    if (existing.value) {
      throw new Error(`Skill "${skill.name}" already exists.`);
    }

    const created = await env.createDir(
      installedDirectory,
      { recursive: true },
      BACKGROUND_CONTEXT
    );
    if (!created.ok) {
      throw created.error;
    }

    const destinationDirectory = installedDirectory;
    const installedWrites = await Promise.all(
      relativeFiles.map((file) =>
        env.writeFile(
          `${destinationDirectory}/${file.path}`,
          file.content,
          BACKGROUND_CONTEXT
        )
      )
    );
    const failedInstalledWrite = installedWrites.find((result) => !result.ok);
    if (failedInstalledWrite && !failedInstalledWrite.ok) {
      throw failedInstalledWrite.error;
    }

    const installed = loadSkillsFromDir({
      dir: installedDirectory,
      source: "piwork",
    });
    const installedSkill = installed.skills.find(
      (candidate) => candidate.name === skill.name
    );
    if (!installedSkill || installed.diagnostics.length > 0) {
      const detail = installed.diagnostics
        .map((item) => item.message)
        .join("; ");
      throw new Error(detail || `Skill "${skill.name}" failed validation.`);
    }

    return installedSkill;
  } catch (error) {
    if (installedDirectory) {
      await env.remove(
        installedDirectory,
        { force: true, recursive: true },
        BACKGROUND_CONTEXT
      );
    }
    throw error;
  } finally {
    await env.remove(
      stagingDirectory,
      { force: true, recursive: true },
      BACKGROUND_CONTEXT
    );
    await env.cleanup(BACKGROUND_CONTEXT);
  }
}

function resolveProjectSkill(cwd: string, name: string) {
  validateSkillName(name);
  const loaded = loadSkillsFromDir({
    dir: getSkillsDirectory(cwd),
    source: "piwork",
  });
  const skill = loaded.skills.find((candidate) => candidate.name === name);
  if (!skill) {
    throw new Error(`Skill "${name}" was not found.`);
  }

  const skillsDirectory = resolve(getSkillsDirectory(cwd));
  const skillDirectory = resolve(dirname(skill.filePath));
  const relativeDirectory = relative(skillsDirectory, skillDirectory);
  if (
    isAbsolute(relativeDirectory) ||
    relativeDirectory === ".." ||
    relativeDirectory.startsWith("../")
  ) {
    throw new Error("The skill is outside the managed project directory.");
  }

  return { relativeDirectory, skill, skillDirectory };
}

export async function deleteProjectSkill(name: string, cwd = process.cwd()) {
  const env = createExecutionEnv(cwd);

  try {
    const { relativeDirectory, skill, skillDirectory } = resolveProjectSkill(
      cwd,
      name
    );
    const target = relativeDirectory ? skillDirectory : skill.filePath;
    const removed = await env.remove(
      target,
      { force: false, recursive: true },
      BACKGROUND_CONTEXT
    );
    if (!removed.ok) {
      throw removed.error;
    }
  } finally {
    await env.cleanup(BACKGROUND_CONTEXT);
  }
}

export type ProjectSkillFileEntry = {
  kind: "file" | "directory";
  name: string;
  path: string;
  size: number;
  mtimeMs: number;
};

export type ProjectSkillFileContent = {
  content: string;
  encoding: "base64" | "text";
  mimeType: string;
  path: string;
  size: number;
  truncated: boolean;
};

const IMAGE_MIME_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function resolveSkillFilePath(skillDirectory: string, requestedPath: string) {
  const normalized = requestedPath.replaceAll("\\", "/");
  const segments = normalized.split("/");

  if (
    !normalized ||
    normalized.startsWith("/") ||
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\0")
    )
  ) {
    throw new Error(`Invalid skill file path: ${requestedPath}`);
  }

  const target = resolve(skillDirectory, normalized);
  const relativePath = relative(skillDirectory, target);
  if (isAbsolute(relativePath) || relativePath.startsWith("..")) {
    throw new Error(`Invalid skill file path: ${requestedPath}`);
  }

  return { relativePath: relativePath.split("\\").join("/"), target };
}

function looksLikeBinary(content: Uint8Array) {
  const limit = Math.min(content.length, 8000);
  for (let index = 0; index < limit; index += 1) {
    if (content[index] === 0) {
      return true;
    }
  }
  return false;
}

export async function listProjectSkillFiles(
  name: string,
  cwd = process.cwd()
): Promise<{ entries: ProjectSkillFileEntry[] }> {
  const env = createExecutionEnv(cwd);

  try {
    const { relativeDirectory, skillDirectory } = resolveProjectSkill(
      cwd,
      name
    );
    if (!relativeDirectory) {
      throw new Error(`Skill "${name}" has no skill folder to browse.`);
    }

    const entries: ProjectSkillFileEntry[] = [];
    const walk = async (directoryPath: string): Promise<void> => {
      if (entries.length >= MAX_SKILL_FILE_ENTRY_COUNT) {
        return;
      }
      const listed = await env.listDir(
        directoryPath ? `${skillDirectory}/${directoryPath}` : skillDirectory,
        BACKGROUND_CONTEXT
      );
      if (!listed.ok) {
        throw listed.error;
      }

      const children = [...listed.value].sort((left, right) =>
        left.name.localeCompare(right.name)
      );
      for (const info of children) {
        if (info.kind === "symlink") {
          continue;
        }
        if (entries.length >= MAX_SKILL_FILE_ENTRY_COUNT) {
          return;
        }
        const relativeInfoPath = directoryPath
          ? `${directoryPath}/${info.name}`
          : info.name;
        entries.push({
          kind: info.kind === "directory" ? "directory" : "file",
          mtimeMs: info.mtimeMs,
          name: info.name,
          path: relativeInfoPath,
          size: info.size,
        });
        if (info.kind === "directory") {
          // biome-ignore lint/performance/noAwaitInLoops: 顺序遍历保证条目上限与稳定排序
          await walk(relativeInfoPath);
        }
      }
    };
    await walk("");

    return {
      entries: entries.sort((left, right) =>
        left.path.localeCompare(right.path)
      ),
    };
  } finally {
    await env.cleanup(BACKGROUND_CONTEXT);
  }
}

export async function readProjectSkillFile(
  name: string,
  requestedPath: string,
  cwd = process.cwd()
): Promise<ProjectSkillFileContent> {
  const env = createExecutionEnv(cwd);

  try {
    const { relativeDirectory, skillDirectory } = resolveProjectSkill(
      cwd,
      name
    );
    if (!relativeDirectory) {
      throw new Error(`Skill "${name}" has no skill folder to browse.`);
    }

    const { relativePath, target } = resolveSkillFilePath(
      skillDirectory,
      requestedPath
    );
    const info = await env.fileInfo(target, BACKGROUND_CONTEXT);
    if (!info.ok) {
      throw info.error;
    }
    if (info.value.kind !== "file") {
      throw new Error(`"${relativePath}" is not a file.`);
    }
    if (info.value.size > MAX_SKILL_PREVIEW_FILE_SIZE) {
      throw new Error(
        `"${relativePath}" exceeds the ${MAX_SKILL_PREVIEW_FILE_SIZE / 1024} KB preview limit.`
      );
    }

    const content = await env.readBinaryFile(target, BACKGROUND_CONTEXT);
    if (!content.ok) {
      throw content.error;
    }

    const imageMimeType =
      IMAGE_MIME_TYPES[extname(relativePath).toLocaleLowerCase()];
    if (imageMimeType) {
      return {
        content: Buffer.from(content.value).toString("base64"),
        encoding: "base64",
        mimeType: imageMimeType,
        path: relativePath,
        size: info.value.size,
        truncated: false,
      };
    }

    if (looksLikeBinary(content.value)) {
      return {
        content: Buffer.from(content.value).toString("base64"),
        encoding: "base64",
        mimeType: "application/octet-stream",
        path: relativePath,
        size: info.value.size,
        truncated: false,
      };
    }

    const text = new TextDecoder("utf-8").decode(content.value);
    return {
      content: text.slice(0, MAX_SKILL_PREVIEW_TEXT_LENGTH),
      encoding: "text",
      mimeType: "text/plain; charset=utf-8",
      path: relativePath,
      size: info.value.size,
      truncated: text.length > MAX_SKILL_PREVIEW_TEXT_LENGTH,
    };
  } finally {
    await env.cleanup(BACKGROUND_CONTEXT);
  }
}

export function buildSkillsSystemPrompt(skills: Skill[]) {
  const availableSkills = formatSkillsForPrompt(skills);

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
    return Promise.reject(new Error(`Unknown skill "${name}".`));
  }

  return formatSkillInvocation(skill, additionalInstructions);
}

/**
 * 与 pi-coding-agent 1.0.0 的 _expandSkillCommand 同构
 * （dist/core/agent-session.js：读 SKILL.md → stripFrontmatter → <skill> 块）；
 * 1.0.0 起 formatSkillInvocation 不再从官方包导出。
 */
async function formatSkillInvocation(
  skill: Skill,
  additionalInstructions?: string
) {
  const env = new NodeExecutionEnv({ cwd: process.cwd() });
  const read = await env.readTextFile(skill.filePath, BACKGROUND_CONTEXT);
  if (!read.ok) {
    throw read.error;
  }
  const body = stripFrontmatter(read.value).trim();
  const skillBlock = `<skill name="${skill.name}" location="${skill.filePath}">\nReferences are relative to ${skill.baseDir}.\n\n${body}\n</skill>`;
  return additionalInstructions
    ? `${skillBlock}\n\n${additionalInstructions}`
    : skillBlock;
}

export function createSkillTools(
  initialSkills: Skill[],
  cwd = process.cwd()
): AgentTool[] {
  const skills = new Map(initialSkills.map((skill) => [skill.name, skill]));

  const loadSkill: AgentTool = {
    description:
      "Load the complete instructions for an available skill before carrying out a matching task.",
    execute: async (_toolCallId, params) => {
      const { name, task } = params as { name: string; task?: string };
      const skill = skills.get(name);
      if (!skill) {
        throw new Error(`Unknown skill "${name}".`);
      }

      return {
        content: [
          {
            text: await formatSkillInvocation(skill, task),
            type: "text",
          },
        ],
        details: { name: skill.name, path: skill.filePath },
      };
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
