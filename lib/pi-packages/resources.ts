import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

/**
 * pi 包资源清点与 skills 发现(纯 node 模块,可被 node --test 直接运行)。
 * 语义对齐 pi 的 readPiManifest / collectDefaultResources
 * (node_modules/@earendil-works/pi-coding-agent/dist/core/package-manager.js)。
 */

export type PiResourceType = "extensions" | "skills" | "prompts" | "themes";

const RESOURCE_TYPES: readonly PiResourceType[] = [
  "extensions",
  "prompts",
  "skills",
  "themes",
];

/** pi package.json 的 `pi` 键清单(仅接受字符串数组字段) */
export type PiManifest = Partial<Record<PiResourceType, string[]>>;

export async function readPiManifest(
  packageRoot: string
): Promise<PiManifest | null> {
  let raw: string;
  try {
    raw = await readFile(join(packageRoot, "package.json"), "utf-8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.charCodeAt(0) === 0xfe_ff ? raw.slice(1) : raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const piKey = (parsed as { pi?: unknown }).pi;
  if (typeof piKey !== "object" || piKey === null || Array.isArray(piKey)) {
    return null;
  }

  const manifest: PiManifest = {};
  for (const type of RESOURCE_TYPES) {
    const entries = (piKey as Record<string, unknown>)[type];
    if (
      Array.isArray(entries) &&
      entries.every((entry) => typeof entry === "string")
    ) {
      manifest[type] = entries as string[];
    }
  }
  return manifest;
}

/** manifest 条目里的覆盖型 pattern(!/+/- 前缀)不是来源路径,清点时排除 */
function isOverridePattern(entry: string) {
  return (
    entry.startsWith("!") || entry.startsWith("+") || entry.startsWith("-")
  );
}

async function safeStat(path: string) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

async function listVisibleEntries(dir: string) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => !entry.name.startsWith("."))
    .filter((entry) => entry.name !== "node_modules")
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * 在目录树中找出技能目录:目录直接含 SKILL.md 则该目录是一个技能,
 * 否则递归子目录(pi collectSkillEntries 语义;浅层优先)。
 * 松散 .md 文件(不以 SKILL.md 命名)不是 piwork 技能流水线支持的形态,跳过。
 */
export async function findSkillDirs(dir: string): Promise<string[]> {
  const info = await safeStat(dir);
  if (!info?.isDirectory()) {
    return [];
  }
  const manifestPath = join(dir, "SKILL.md");
  const manifestInfo = await safeStat(manifestPath);
  if (manifestInfo?.isFile()) {
    return [dir];
  }

  const results: string[] = [];
  for (const entry of await listVisibleEntries(dir)) {
    if (!entry.isDirectory()) {
      continue;
    }
    // biome-ignore lint/performance/noAwaitInLoops: 浅层优先的有序遍历
    results.push(...(await findSkillDirs(join(dir, entry.name))));
  }
  return results;
}

/** 汇总一个包的某类资源文件数(manifest 条目优先,无条目回退约定目录) */
export async function countPackageResourceFiles(
  packageRoot: string,
  type: PiResourceType,
  manifest: PiManifest | null
): Promise<number> {
  const entries = manifest?.[type]?.filter(
    (entry) => !isOverridePattern(entry)
  );
  if (entries && entries.length > 0) {
    let count = 0;
    for (const entry of entries) {
      const target = resolve(packageRoot, entry);
      // biome-ignore lint/performance/noAwaitInLoops: 顺序遍历保证计数稳定
      const info = await safeStat(target);
      if (!info) {
        continue;
      }
      if (info.isFile()) {
        count += 1;
        continue;
      }
      count += (await listResourceFiles(target, type)).length;
    }
    return count;
  }
  const conventionDir = join(packageRoot, type);
  const dirInfo = await safeStat(conventionDir);
  if (!dirInfo?.isDirectory()) {
    return 0;
  }
  return (await listResourceFiles(conventionDir, type)).length;
}

async function listResourceFiles(
  dir: string,
  type: PiResourceType
): Promise<string[]> {
  const info = await safeStat(dir);
  if (!info?.isDirectory()) {
    return [];
  }
  const files: string[] = [];
  for (const entry of await listVisibleEntries(dir)) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      // biome-ignore lint/performance/noAwaitInLoops: 深度遍历
      files.push(...(await listResourceFiles(fullPath, type)));
      continue;
    }
    if (matchesResourceFile(entry.name, type)) {
      files.push(fullPath);
    }
  }
  return files;
}

function matchesResourceFile(name: string, type: PiResourceType) {
  switch (type) {
    case "extensions":
      return /\.(ts|js)$/.test(name);
    case "prompts":
    case "skills":
      return /\.md$/.test(name);
    case "themes":
      return /\.json$/.test(name);
    default:
      return false;
  }
}

/** 与 lib/ai/skills 的 MAX_SKILL_UPLOAD_* 上限保持一致 */
export const MAX_PACKAGE_SKILL_FILE_COUNT = 200;
export const MAX_PACKAGE_SKILL_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_PACKAGE_SKILL_TOTAL_SIZE = 15 * 1024 * 1024;

export type PackageSkillFile = {
  content: Uint8Array;
  /** 相对技能目录的路径(不含技能目录名) */
  path: string;
  /** 相对包根的路径(诊断用) */
  sourcePath: string;
};

export type CollectedPackageSkill = {
  /** 技能目录名(installProjectSkill 的 folder 前缀) */
  folderName: string;
  files: PackageSkillFile[];
};

/**
 * 收集一个技能目录的全部文件,遵守 piwork 技能上传限额
 * (200 文件 / 单文件 5MB / 总量 15MB)。超限抛错,由调用方按"跳过该技能"处理。
 */
export async function collectPackageSkillFiles(
  skillDir: string,
  packageRoot: string
): Promise<CollectedPackageSkill> {
  const files: PackageSkillFile[] = [];
  let totalSize = 0;

  const walk = async (dir: string, prefix: string): Promise<void> => {
    for (const entry of await listVisibleEntries(dir)) {
      if (files.length >= MAX_PACKAGE_SKILL_FILE_COUNT) {
        throw new Error(
          `Skill exceeds the ${MAX_PACKAGE_SKILL_FILE_COUNT} file limit.`
        );
      }
      const fullPath = join(dir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        // biome-ignore lint/performance/noAwaitInLoops: 顺序遍历保证限额与稳定顺序
        await walk(fullPath, relativePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const info = await safeStat(fullPath);
      if (!info?.isFile()) {
        continue;
      }
      if (info.size > MAX_PACKAGE_SKILL_FILE_SIZE) {
        throw new Error(
          `File "${relativePath}" exceeds the ${
            MAX_PACKAGE_SKILL_FILE_SIZE / (1024 * 1024)
          } MB limit.`
        );
      }
      totalSize += info.size;
      if (totalSize > MAX_PACKAGE_SKILL_TOTAL_SIZE) {
        throw new Error(
          `Skill exceeds the ${
            MAX_PACKAGE_SKILL_TOTAL_SIZE / (1024 * 1024)
          } MB total limit.`
        );
      }
      const content = await readFile(fullPath);
      files.push({
        content,
        path: relativePath,
        sourcePath: fullPath.slice(packageRoot.length + 1),
      });
    }
  };

  await walk(skillDir, "");
  return { files, folderName: basename(skillDir) };
}

/** 发现一个 pi 包内的全部技能目录(manifest 条目优先,回退 skills/ 约定目录) */
export async function discoverPackageSkillDirs(
  packageRoot: string,
  manifest: PiManifest | null
): Promise<string[]> {
  const entries = manifest?.skills?.filter(
    (entry) => !isOverridePattern(entry)
  );
  if (entries && entries.length > 0) {
    const dirs: string[] = [];
    for (const entry of entries) {
      const target = resolve(packageRoot, entry);
      // biome-ignore lint/performance/noAwaitInLoops: 顺序遍历保证发现顺序稳定
      const info = await safeStat(target);
      if (!info) {
        continue;
      }
      if (info.isFile()) {
        // manifest 直接指向 SKILL.md 文件:技能目录是其所在目录
        if (basename(target) === "SKILL.md") {
          dirs.push(target.slice(0, target.length - "SKILL.md".length - 1));
        }
        continue;
      }
      dirs.push(...(await findSkillDirs(target)));
    }
    return [...new Set(dirs)];
  }
  return findSkillDirs(join(packageRoot, "skills"));
}
