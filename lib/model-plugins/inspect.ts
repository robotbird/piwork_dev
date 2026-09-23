import { createHash } from "node:crypto";
import { unzipSync } from "fflate";

import {
  isForbiddenEntryPath,
  isUnsafeEntryPath,
  PACKAGE_LIMITS,
  type PackageInspection,
  PLUGIN_PACKAGE_NAME_PATTERN,
  PluginPackageError,
  packageError,
  pluginManifestSchema,
  providerKeyFromFileName,
  validatePackageJson,
} from "./contract";

/**
 * ZIP 检查：命名 → 容量/路径安全 → 结构 → manifest → package.json。
 * 全程在内存中解包（fflate），不做任何执行，符合 §8.2 的检查顺序。
 */
export function inspectPluginZip(
  fileName: string,
  zipBytes: Uint8Array
): PackageInspection {
  if (!/^[^/\\]+$/.test(fileName)) {
    throw new PluginPackageError(
      "invalid_file_name",
      "Package file name must not contain path separators"
    );
  }
  if (fileName.endsWith(".zip") === false) {
    throw new PluginPackageError(
      "invalid_file_name",
      `Package must be a .zip file: ${fileName}`
    );
  }
  if (!PLUGIN_PACKAGE_NAME_PATTERN.test(fileName)) {
    throw new PluginPackageError(
      "invalid_file_name",
      `Package name must match ^piwork-llm-[a-z0-9]+(?:-[a-z0-9]+)*\\.zip$ (no version, no uppercase, no underscore): ${fileName}`
    );
  }

  const packageId = fileName.slice(0, -".zip".length);
  const providerKey = providerKeyFromFileName(fileName);
  if (packageId !== `piwork-llm-${providerKey}`) {
    throw new PluginPackageError(
      "invalid_file_name",
      `Package name must match ^piwork-llm-[a-z0-9]+(?:-[a-z0-9]+)*\\.zip$: ${fileName}`
    );
  }

  if (zipBytes.byteLength > PACKAGE_LIMITS.maxZipBytes) {
    throw new PluginPackageError(
      "package_too_large",
      `Package exceeds ${PACKAGE_LIMITS.maxZipBytes} bytes`
    );
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBytes);
  } catch (error) {
    throw packageError(
      "invalid_zip",
      `Unable to read ZIP: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }

  const files = Object.keys(entries);
  if (files.length === 0) {
    throw new PluginPackageError("empty_package", "Package contains no files");
  }
  if (files.length > PACKAGE_LIMITS.maxFileCount) {
    throw new PluginPackageError(
      "too_many_files",
      `Package contains ${files.length} files (limit ${PACKAGE_LIMITS.maxFileCount})`
    );
  }

  let totalBytes = 0;
  for (const entryPath of files) {
    if (isUnsafeEntryPath(entryPath)) {
      throw new PluginPackageError(
        "unsafe_path",
        `Unsafe entry path in package: ${entryPath}`
      );
    }
    if (isForbiddenEntryPath(entryPath)) {
      throw new PluginPackageError(
        "forbidden_file",
        `Forbidden file type in package: ${entryPath}`
      );
    }
    const size = entries[entryPath].byteLength;
    if (size > PACKAGE_LIMITS.maxFileBytes) {
      throw new PluginPackageError(
        "file_too_large",
        `File too large in package: ${entryPath} (${size} bytes)`
      );
    }
    totalBytes += size;
  }
  if (totalBytes > PACKAGE_LIMITS.maxTotalBytes) {
    throw new PluginPackageError(
      "package_too_large",
      `Uncompressed size ${totalBytes} exceeds limit ${PACKAGE_LIMITS.maxTotalBytes}`
    );
  }

  const requiredFiles = ["piwork.plugin.json", "package.json", "src/index.ts"];
  for (const required of requiredFiles) {
    if (!entries[required]) {
      throw new PluginPackageError(
        "missing_file",
        `Package is missing required file: ${required}`
      );
    }
  }

  const manifestResult = pluginManifestSchema.safeParse(
    decodeJson(entries["piwork.plugin.json"], "piwork.plugin.json")
  );
  if (!manifestResult.success) {
    throw new PluginPackageError(
      "invalid_manifest",
      `piwork.plugin.json: ${manifestResult.error.message}`
    );
  }
  const manifest = manifestResult.data;

  // 文件名 / manifest id / provider key 三者派生关系必须一致（§5.1）
  if (manifest.id !== packageId) {
    throw new PluginPackageError(
      "manifest_id_mismatch",
      `manifest id "${manifest.id}" must equal package file name "${packageId}"`
    );
  }
  if (manifest.provider !== providerKey) {
    throw new PluginPackageError(
      "manifest_provider_mismatch",
      `manifest provider "${manifest.provider}" must equal provider key "${providerKey}" derived from file name`
    );
  }
  if (!manifest.capabilities.includes("llm")) {
    throw new PluginPackageError(
      "unsupported_capability",
      'First-phase packages must declare the "llm" capability'
    );
  }

  const dependencies = validatePackageJson(
    fileName,
    new TextDecoder().decode(entries["package.json"]),
    manifest
  );

  for (const assetPath of Object.values(manifest.assets ?? {})) {
    if (!entries[assetPath]) {
      throw new PluginPackageError(
        "missing_asset",
        `Manifest references missing asset: ${assetPath}`
      );
    }
  }

  return {
    capabilities: manifest.capabilities,
    dependencies,
    description: manifest.description,
    files,
    manifest,
    name: manifest.name,
    networkHosts: manifest.permissions.network,
    packageId,
    providerKey,
    schemaVersion: manifest.schemaVersion,
    sha256: createHash("sha256").update(zipBytes).digest("hex"),
    sizeBytes: zipBytes.byteLength,
    version: manifest.version,
  };
}

function decodeJson(bytes: Uint8Array, fileName: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw packageError(
      "invalid_json",
      `${fileName} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}
