import type { Skill } from "@earendil-works/pi-agent-core";
import {
  deleteSkillRecord,
  getSkillRecords,
  setSkillRecordEnabled,
  upsertSkillRecord,
} from "@/lib/db/queries";
import {
  deleteProjectSkill,
  loadAllProjectSkills,
  loadProjectSkillSummaries,
  type ProjectSkillSummary,
  validateSkillName,
} from "./skills";

function projectSkillRelativePath(name: string) {
  return `.pi/skills/${name}/SKILL.md`;
}

async function reconcileProjectSkills(cwd = process.cwd()) {
  const [{ diagnostics, skills }, records] = await Promise.all([
    loadProjectSkillSummaries(cwd),
    getSkillRecords(),
  ]);
  const recordsByName = new Map(records.map((record) => [record.name, record]));

  await Promise.all(
    skills.flatMap((summary) => {
      const record = recordsByName.get(summary.name);
      const relativePath =
        record?.relativePath ?? projectSkillRelativePath(summary.name);
      if (
        record &&
        record.description === summary.description &&
        record.displayName === summary.displayName &&
        record.source === summary.source &&
        record.version === summary.version &&
        record.relativePath === relativePath
      ) {
        return [];
      }
      return [
        upsertSkillRecord({
          description: summary.description,
          displayName: summary.displayName,
          enabled: record?.enabled ?? summary.enabled,
          name: summary.name,
          relativePath,
          source: record?.source ?? summary.source,
          uploadedBy: record?.uploadedBy ?? null,
          version: summary.version,
        }),
      ];
    })
  );

  return { diagnostics, diskSkills: skills };
}

export async function loadManagedProjectSkillSummaries({
  cwd = process.cwd(),
  enabledOnly = false,
}: {
  cwd?: string;
  enabledOnly?: boolean;
} = {}) {
  const { diagnostics, diskSkills } = await reconcileProjectSkills(cwd);
  const records = await getSkillRecords({ enabledOnly });
  const diskByName = new Map(diskSkills.map((item) => [item.name, item]));
  const skills: ProjectSkillSummary[] = records.flatMap((record) => {
    const diskSkill = diskByName.get(record.name);
    if (!diskSkill) {
      return [];
    }
    return [
      {
        description: record.description,
        displayName: record.displayName,
        enabled: record.enabled,
        name: record.name,
        source: record.source,
        version: record.version,
      },
    ];
  });

  return { diagnostics, skills };
}

export async function loadEnabledManagedProjectSkills(cwd = process.cwd()) {
  const { diagnostics } = await reconcileProjectSkills(cwd);
  const [{ skills: diskSkills }, records] = await Promise.all([
    loadAllProjectSkills(cwd),
    getSkillRecords({ enabledOnly: true }),
  ]);
  const enabledNames = new Set(records.map((record) => record.name));

  return {
    diagnostics,
    skills: diskSkills.filter((item) => enabledNames.has(item.name)),
  } satisfies { diagnostics: typeof diagnostics; skills: Skill[] };
}

export async function registerManagedProjectSkill({
  name,
  uploadedBy,
  cwd = process.cwd(),
}: {
  name: string;
  uploadedBy: string | null;
  cwd?: string;
}) {
  validateSkillName(name);
  const { skills } = await loadProjectSkillSummaries(cwd);
  const summary = skills.find((item) => item.name === name);
  if (!summary) {
    throw new Error(`Skill "${name}" was not found after installation.`);
  }

  return await upsertSkillRecord({
    description: summary.description,
    displayName: summary.displayName,
    enabled: true,
    name: summary.name,
    relativePath: projectSkillRelativePath(summary.name),
    source: summary.source,
    uploadedBy,
    version: summary.version,
  });
}

/**
 * 注册一个从 pi 包提取的技能。与 registerManagedProjectSkill 的差异:
 * source 固定为 "pi-package" 并落 sourcePackage 列(卸载联动依据),
 * 不使用磁盘推导的 source(那里只有 catalog/upload 二值)。
 */
export async function registerPiPackageSkill({
  name,
  sourcePackage,
  uploadedBy,
  cwd = process.cwd(),
}: {
  name: string;
  sourcePackage: string;
  uploadedBy: string | null;
  cwd?: string;
}) {
  validateSkillName(name);
  const { skills } = await loadProjectSkillSummaries(cwd);
  const summary = skills.find((item) => item.name === name);
  if (!summary) {
    throw new Error(`Skill "${name}" was not found after installation.`);
  }

  return await upsertSkillRecord({
    description: summary.description,
    displayName: summary.displayName,
    enabled: true,
    name: summary.name,
    relativePath: projectSkillRelativePath(summary.name),
    source: "pi-package",
    sourcePackage,
    uploadedBy,
    version: summary.version,
  });
}

export async function setManagedProjectSkillEnabled(
  name: string,
  enabled: boolean
) {
  validateSkillName(name);
  const updated = await setSkillRecordEnabled({ enabled, name });
  if (!updated) {
    throw new Error(`Skill "${name}" was not found.`);
  }
}

export async function deleteManagedProjectSkill(name: string) {
  validateSkillName(name);
  await deleteProjectSkill(name);
  await deleteSkillRecord(name);
}
