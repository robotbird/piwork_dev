import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";

import {
  DefaultPackageManager,
  type PackageManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

import {
  deleteManagedProjectSkill,
  registerPiPackageSkill,
} from "@/lib/ai/managed-skills";
import { installProjectSkill } from "@/lib/ai/skills";
import { isProductionEnvironment, isTestEnvironment } from "@/lib/constants";
import {
  createPiPackage,
  deletePiPackage,
  getPiPackageBySource,
  getSystemPiPackage,
  updatePiPackage,
} from "@/lib/db/pi-package-queries";
import { getSkillRecordsBySourcePackage } from "@/lib/db/queries";
import type { PiPackageResourceSummary } from "@/lib/db/schema";
import {
  collectPackageSkillFiles,
  countPackageResourceFiles,
  discoverPackageSkillDirs,
  type PiResourceType,
  readPiManifest,
} from "./resources";

/**
 * 官方 pi 包安装/卸载流水线。
 * 安装动作 = 服务端 DefaultPackageManager.installAndPersist(受管 agentDir,
 * pi.dev/docs/latest/packages;与 pi CLI `pi install` 同一落盘布局),
 * 包内 skills 提取进 piwork 技能流水线,extensions 仅清点待扩展运行时。
 */

export const MANAGED_AGENT_DIR = resolve(process.cwd(), ".piwork", "pi-agent");
const REPO_ROOT = process.cwd();

/** 系统插件:MCP 服务适配器(Task 1 的 .mcp.json 消费方),spike C 实测版本 */
export const SYSTEM_PI_PACKAGE_SOURCE = "npm:pi-mcp-adapter@2.37.0";

export type PiPackageErrorCode =
  | "alreadyInstalled"
  | "installFailed"
  | "invalidSource"
  | "notFound"
  | "systemProtected";

export class PiPackageError extends Error {
  readonly code: PiPackageErrorCode;
  readonly detail?: string;

  constructor(code: PiPackageErrorCode, message?: string, detail?: string) {
    super(message ?? code);
    this.code = code;
    this.detail = detail;
    this.name = "PiPackageError";
  }
}

let packageManagerPromise: Promise<PackageManager> | null = null;

/** 受管 agentDir 下的 PackageManager 单例(与宿主用户 ~/.pi 完全隔离) */
function getPiPackageManager(): Promise<PackageManager> {
  if (!packageManagerPromise) {
    packageManagerPromise = (async () => {
      await mkdir(MANAGED_AGENT_DIR, { recursive: true });
      const settingsManager = SettingsManager.create(
        process.cwd(),
        MANAGED_AGENT_DIR
      );
      return new DefaultPackageManager({
        agentDir: MANAGED_AGENT_DIR,
        cwd: process.cwd(),
        settingsManager,
      });
    })();
  }
  return packageManagerPromise;
}

/** 串行变更队列:install/uninstall 全走此队列,防 settings.json 并发写坏 */
let mutationQueue: Promise<unknown> = Promise.resolve();
function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
  const next = mutationQueue.then(operation, operation);
  mutationQueue = next.catch(() => undefined);
  return next;
}

const NPM_NAME_PATTERN = /^@?[a-z0-9][a-z0-9._/-]*$/i;
const NPM_VERSION_PATTERN = /^[\w.+\-^~*<>=]+$/;

/**
 * 校验并规范化安装源:"npm:<name>[@<version>]",或本地绝对路径
 * (仅开发/测试环境且位于仓库内,供 e2e fixture 使用)。
 */
export function validatePiPackageSource(raw: string): string {
  const source = raw.trim();
  if (!source) {
    throw new PiPackageError("invalidSource");
  }

  if (source.startsWith("npm:")) {
    const spec = source.slice("npm:".length);
    let name = spec;
    let version = "";
    // @scope/name@version:跳过开头的 scope @ 再找版本分隔符
    const versionSeparator = spec.startsWith("@")
      ? spec.indexOf("@", 1)
      : spec.indexOf("@");
    if (versionSeparator > 0) {
      name = spec.slice(0, versionSeparator);
      version = spec.slice(versionSeparator + 1);
    }
    if (
      !name ||
      name.length > 214 ||
      !NPM_NAME_PATTERN.test(name) ||
      (version && (version.length > 64 || !NPM_VERSION_PATTERN.test(version)))
    ) {
      throw new PiPackageError("invalidSource");
    }
    return version ? `npm:${name}@${version}` : `npm:${name}`;
  }

  if (isAbsolute(source)) {
    if (isProductionEnvironment) {
      throw new PiPackageError("invalidSource");
    }
    const resolved = resolve(source);
    const relativeToRepo = relative(REPO_ROOT, resolved);
    if (!relativeToRepo || relativeToRepo.startsWith("..")) {
      throw new PiPackageError("invalidSource");
    }
    return resolved;
  }

  throw new PiPackageError("invalidSource");
}

async function readPackageJson(installedPath: string) {
  try {
    const raw = await readFile(resolve(installedPath, "package.json"), "utf-8");
    const stripped = raw.charCodeAt(0) === 0xfe_ff ? raw.slice(1) : raw;
    const parsed = JSON.parse(stripped) as {
      name?: unknown;
      version?: unknown;
    };
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      version: typeof parsed.version === "string" ? parsed.version : "",
    };
  } catch {
    return { name: "", version: "" };
  }
}

async function buildResourceSummary(
  installedPath: string
): Promise<PiPackageResourceSummary> {
  const manifest = await readPiManifest(installedPath);
  const summary: PiPackageResourceSummary = {
    extensions: 0,
    prompts: 0,
    skills: 0,
    themes: 0,
  };
  for (const type of [
    "extensions",
    "prompts",
    "skills",
    "themes",
  ] as const satisfies PiResourceType[]) {
    // biome-ignore lint/performance/noAwaitInLoops: 四类资源顺序清点
    summary[type] = await countPackageResourceFiles(
      installedPath,
      type,
      manifest
    );
  }
  return summary;
}

export type InstallPiPackageResult = {
  installedSkills: string[];
  name: string;
  resourceSummary: PiPackageResourceSummary;
  skippedSkills: Array<{ name: string; reason: string }>;
  source: string;
  version: string;
};

/** 提取包内 skills 进 .pi/skills 并注册技能记录;名冲突/超限按跳过处理 */
async function extractPackageSkills(
  installedPath: string,
  source: string,
  userId: string | null
): Promise<{
  installedSkills: string[];
  skippedSkills: Array<{ name: string; reason: string }>;
}> {
  const manifest = await readPiManifest(installedPath);
  const skillDirs = await discoverPackageSkillDirs(installedPath, manifest);
  const installedSkills: string[] = [];
  const skippedSkills: Array<{ name: string; reason: string }> = [];

  for (const skillDir of skillDirs) {
    const folderName = basename(skillDir);
    try {
      // biome-ignore lint/performance/noAwaitInLoops: 逐技能顺序提取,冲突即跳过
      const collected = await collectPackageSkillFiles(skillDir, installedPath);
      const skill = await installProjectSkill({
        files: collected.files.map((file) => ({
          content: file.content,
          path: `${folderName}/${file.path}`,
        })),
      });
      await registerPiPackageSkill({
        name: skill.name,
        sourcePackage: source,
        uploadedBy: userId,
      });
      installedSkills.push(skill.name);
    } catch (error) {
      skippedSkills.push({
        name: folderName,
        reason: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  return { installedSkills, skippedSkills };
}

export async function installPiPackage({
  source: rawSource,
  system = false,
  userId,
}: {
  source: string;
  system?: boolean;
  userId: string | null;
}): Promise<InstallPiPackageResult> {
  const source = validatePiPackageSource(rawSource);
  if (await getPiPackageBySource(source)) {
    throw new PiPackageError("alreadyInstalled", source);
  }

  return enqueueMutation(async () => {
    // 队列内复查:并发请求里前一个可能刚装完同一个包
    if (await getPiPackageBySource(source)) {
      throw new PiPackageError("alreadyInstalled", source);
    }

    const manager = await getPiPackageManager();
    try {
      await manager.installAndPersist(source);
    } catch (error) {
      // biome-ignore lint/style/useErrorCause: detail 供 API 返回安装失败原因,不是 cause
      throw new PiPackageError(
        "installFailed",
        `Failed to install ${source}`,
        error instanceof Error ? error.message : undefined
      );
    }

    try {
      const installedPath = manager.getInstalledPath(source, "user");
      if (!installedPath) {
        throw new Error("Installed package path not found");
      }
      const { name, version } = await readPackageJson(installedPath);
      const resourceSummary = await buildResourceSummary(installedPath);
      const { installedSkills, skippedSkills } = await extractPackageSkills(
        installedPath,
        source,
        userId
      );

      await createPiPackage({
        createdBy: userId,
        installedPath,
        installedSkills,
        name: name || source,
        resourceSummary,
        source,
        system,
        version,
      });

      return {
        installedSkills,
        name: name || source,
        resourceSummary,
        skippedSkills,
        source,
        version,
      };
    } catch (error) {
      // 安装后流水线失败:回滚包落盘与 settings,不留半装状态
      await manager.removeAndPersist(source).catch(() => undefined);
      if (error instanceof PiPackageError) {
        throw error;
      }
      // biome-ignore lint/style/useErrorCause: detail 供 API 返回处理失败原因,不是 cause
      throw new PiPackageError(
        "installFailed",
        `Failed to process ${source}`,
        error instanceof Error ? error.message : undefined
      );
    }
  });
}

export async function uninstallPiPackage(source: string): Promise<{
  deleted: boolean;
  removedSkills: string[];
}> {
  const record = await getPiPackageBySource(source);
  if (!record) {
    throw new PiPackageError("notFound", source);
  }
  if (record.system) {
    throw new PiPackageError("systemProtected", source);
  }

  return enqueueMutation(async () => {
    const skillRecords = await getSkillRecordsBySourcePackage(source);
    const removedSkills: string[] = [];
    for (const recordSkill of skillRecords) {
      try {
        // biome-ignore lint/performance/noAwaitInLoops: 逐技能删除,失败继续卸载
        await deleteManagedProjectSkill(recordSkill.name);
        removedSkills.push(recordSkill.name);
      } catch {
        // 技能磁盘态可能已被动过;继续卸载包本身
      }
    }

    const manager = await getPiPackageManager();
    await manager.removeAndPersist(source).catch(() => undefined);
    await deletePiPackage(source);
    return { deleted: true, removedSkills };
  });
}

export type SystemPackageStatus = "failed" | "installed" | "ready" | "skipped";

/** 会话级请求参数默认值(复刻旧直连链路的 maxRetries/timeoutMs 边界,经 settings.json 生效) */
const MANAGED_SETTINGS_RETRY_DEFAULTS = {
  enabled: false,
  provider: { maxRetries: 2, timeoutMs: 55_000 },
};

let managedSettingsEnsured = false;

/**
 * 确保受管 agentDir 的 settings.json 带会话级 retry 配置:
 * provider 块复刻聊天链路原有的 maxRetries/timeoutMs 边界;enabled:false
 * 关掉会话自动重试(默认 3 次+递增延迟会顶爆 serverless 60s 上限)。
 * 直接读改写文件(SettingsManager 未暴露 provider retry 的 setter;
 * persistScopedSettings 带锁且只合并 modified 字段,安装/卸载不会冲掉本块)。
 * 仅补缺省值,管理员自定义优先。幂等,进程内只真正检查一次。
 */
export async function ensureManagedAgentSettings(): Promise<void> {
  if (managedSettingsEnsured || isTestEnvironment) {
    return;
  }
  managedSettingsEnsured = true;
  const target = resolve(MANAGED_AGENT_DIR, "settings.json");
  let current: Record<string, unknown> = {};
  try {
    current = JSON.parse(await readFile(target, "utf8"));
  } catch {
    // 首次生成或旧文件不可读:按空对象处理
  }
  const retry = (current.retry ?? {}) as Record<string, unknown>;
  const provider = (retry.provider ?? {}) as Record<string, unknown>;
  const merged = {
    ...current,
    retry: {
      ...retry,
      enabled: retry.enabled ?? MANAGED_SETTINGS_RETRY_DEFAULTS.enabled,
      provider: {
        ...provider,
        maxRetries:
          provider.maxRetries ??
          MANAGED_SETTINGS_RETRY_DEFAULTS.provider.maxRetries,
        timeoutMs:
          provider.timeoutMs ??
          MANAGED_SETTINGS_RETRY_DEFAULTS.provider.timeoutMs,
      },
    },
  };
  const serialized = `${JSON.stringify(merged, null, 2)}\n`;
  if (serialized !== `${JSON.stringify(current, null, 2)}\n`) {
    await mkdir(MANAGED_AGENT_DIR, { recursive: true });
    await writeFile(target, serialized, "utf8");
  }
}

/** 懒播种系统插件(pi-mcp-adapter):幂等,失败降级不抛错,测试环境跳过 */
export async function ensureSystemPiPackagesInstalled(): Promise<SystemPackageStatus> {
  if (isTestEnvironment) {
    return "skipped";
  }
  try {
    await ensureManagedAgentSettings();
    if (await getSystemPiPackage()) {
      return "ready";
    }
    // 已被手动装过普通版:升级为系统标记
    const manual = await getPiPackageBySource(SYSTEM_PI_PACKAGE_SOURCE);
    if (manual) {
      if (!manual.system) {
        await updatePiPackage(SYSTEM_PI_PACKAGE_SOURCE, { system: true });
      }
      return "ready";
    }
    await installPiPackage({
      source: SYSTEM_PI_PACKAGE_SOURCE,
      system: true,
      userId: null,
    });
    return "installed";
  } catch (error) {
    console.warn("Failed to seed system pi package:", error);
    return "failed";
  }
}
