import type { LocalizedText } from "@piwork/model-provider-sdk";
import { z } from "zod";

/**
 * piwork-llm-* 插件包契约（docs/model-provider-plugin-architecture.md §5）。
 * 本模块只做纯校验与类型定义，不触碰文件系统，可被任意宿主复用。
 */

/** 安装包文件名规则：piwork-llm-<provider>.zip（小写 kebab-case） */
export const PLUGIN_PACKAGE_NAME_PATTERN =
  /^piwork-llm-[a-z0-9]+(?:-[a-z0-9]+)*\.zip$/;

export const PLUGIN_PACKAGE_PREFIX = "piwork-llm-";

/** 从合法文件名派生 provider key */
export function providerKeyFromFileName(fileName: string): string {
  return fileName.slice(
    PLUGIN_PACKAGE_PREFIX.length,
    fileName.length - ".zip".length
  );
}

/** 首期依赖 allowlist：SDK + Pi 官方包，其余一律拒绝 */
export const DEPENDENCY_ALLOWLIST = new Set([
  "@earendil-works/pi-ai",
  "@piwork/model-provider-sdk",
]);

/** 包体安全限制 */
export const PACKAGE_LIMITS = {
  /** 单文件最大字节数 */
  maxFileBytes: 8 * 1024 * 1024,
  /** 解压后文件总数 */
  maxFileCount: 500,
  /** 最大路径深度（a/b/c → 3） */
  maxPathDepth: 8,
  /** 解压后总字节数 */
  maxTotalBytes: 64 * 1024 * 1024,
  /** 压缩包最大字节数 */
  maxZipBytes: 20 * 1024 * 1024,
};

/** 禁止出现的扩展名：其他语言运行时与可执行产物 */
const FORBIDDEN_EXTENSIONS = [
  ".py",
  ".pyc",
  ".pyo",
  ".sh",
  ".bash",
  ".zsh",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".node",
  ".wasm",
  ".bin",
  ".bat",
  ".cmd",
  ".ps1",
];

const FORBIDDEN_FILE_NAMES = new Set([
  "pyproject.toml",
  "requirements.txt",
  "uv.lock",
  "setup.py",
  "makefile",
]);

export function isForbiddenEntryPath(entryPath: string): boolean {
  const normalized = entryPath.replace(/\\/g, "/");
  const lower = normalized.toLowerCase();
  if (
    FORBIDDEN_FILE_NAMES.has(lower) ||
    FORBIDDEN_EXTENSIONS.some((ext) => lower.endsWith(ext))
  ) {
    return true;
  }
  return false;
}

/** 校验 zip 内路径安全性（绝对路径 / .. 穿越 / 空段） */
export function isUnsafeEntryPath(entryPath: string): boolean {
  const normalized = entryPath.replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("..")) {
    return true;
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === ".")) {
    return true;
  }
  return segments.length > PACKAGE_LIMITS.maxPathDepth;
}

/** piwork.plugin.json schema */
export const pluginManifestSchema = z.object({
  assets: z.record(z.string(), z.string()).optional(),
  capabilities: z.array(z.string()).min(1),
  description: z.record(z.string(), z.string()),
  id: z.string().min(1),
  name: z.string().min(1),
  permissions: z.object({
    environment: z.array(z.string()),
    filesystem: z.literal("none"),
    network: z.array(z.string()),
  }),
  provider: z.string().min(1),
  runtime: z.object({
    entry: z.literal("dist/index.js"),
    language: z.literal("typescript"),
    node: z.string().min(1),
    source: z.literal("src/index.ts"),
  }),
  schemaVersion: z.literal(1),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "version must be semver (no pre-release)"),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;

const packageJsonSchema = z.object({
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  name: z.string().min(1),
  scripts: z.record(z.string(), z.string()).optional(),
  version: z.string().min(1),
});

/** 检查通过后产出的包摘要 */
export type PackageInspection = {
  packageId: string;
  providerKey: string;
  version: string;
  schemaVersion: number;
  name: string;
  description: LocalizedText;
  networkHosts: string[];
  capabilities: string[];
  dependencies: Record<string, string>;
  files: string[];
  sha256: string;
  sizeBytes: number;
  manifest: PluginManifest;
};

export class PluginPackageError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PluginPackageError";
    this.code = code;
  }
}

/**
 * catch 块内的构造入口：把原始错误放入 cause。
 * （useErrorCause 规则只识别第二参数 ErrorOptions 位置，故经由此工厂转发）
 */
export function packageError(
  code: string,
  message: string,
  cause?: unknown
): PluginPackageError {
  return new PluginPackageError(
    code,
    message,
    cause === undefined ? undefined : { cause }
  );
}

/** 校验 package.json：无 lifecycle scripts，依赖在 allowlist 内且固定版本 */
export function validatePackageJson(
  fileName: string,
  raw: string,
  manifest: PluginManifest
): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw packageError(
      "invalid_package_json",
      `${fileName}: package.json is not valid JSON`,
      error
    );
  }

  const result = packageJsonSchema.safeParse(parsed);
  if (!result.success) {
    throw new PluginPackageError(
      "invalid_package_json",
      `${fileName}: ${result.error.message}`
    );
  }
  const pkg = result.data;

  const scripts = Object.keys(pkg.scripts ?? {});
  if (scripts.length > 0) {
    throw new PluginPackageError(
      "forbidden_scripts",
      `${fileName}: package scripts are not allowed (found: ${scripts.join(", ")})`
    );
  }
  if (pkg.devDependencies && Object.keys(pkg.devDependencies).length > 0) {
    throw new PluginPackageError(
      "forbidden_dependencies",
      `${fileName}: devDependencies are not allowed in plugin packages`
    );
  }

  for (const [name, range] of Object.entries(pkg.dependencies ?? {})) {
    if (!DEPENDENCY_ALLOWLIST.has(name)) {
      throw new PluginPackageError(
        "forbidden_dependencies",
        `${fileName}: dependency "${name}" is not in the allowlist`
      );
    }
    if (!/^\d+\.\d+\.\d+$/.test(range)) {
      throw new PluginPackageError(
        "unpinned_dependency",
        `${fileName}: dependency "${name}" must be pinned to an exact version`
      );
    }
  }

  if (pkg.name !== manifest.id) {
    throw new PluginPackageError(
      "package_id_mismatch",
      `${fileName}: package.json name "${pkg.name}" must equal manifest id "${manifest.id}"`
    );
  }
  if (pkg.version !== manifest.version) {
    throw new PluginPackageError(
      "package_version_mismatch",
      `${fileName}: package.json version must equal manifest version "${manifest.version}"`
    );
  }

  return pkg.dependencies ?? {};
}
