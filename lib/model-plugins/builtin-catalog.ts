// biome-ignore-all lint/performance/noAwaitInLoops: package inspection is intentionally sequential and bounded

import "server-only";

import { glob, readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ProviderDefinition } from "@piwork/model-provider-sdk";
import { zipSync } from "fflate";

import { ProviderPluginManager } from "./manager";

export type BuiltinPluginPackage = {
  /** Public plugin metadata, including the optional default API endpoint. */
  definition: ProviderDefinition;
  /** manifest assets.icon 声明的包内路径（例如 assets/icon.svg），未声明时为 null */
  iconPath: string | null;
  fileName: string;
  packageId: string;
  providerKey: string;
  version: string;
  zipBytes: Uint8Array;
};

let catalogPromise: Promise<BuiltinPluginPackage[]> | null = null;

export function resetBuiltinPluginCatalog(): void {
  catalogPromise = null;
}

export function loadBuiltinPluginCatalog(): Promise<BuiltinPluginPackage[]> {
  catalogPromise ??= buildCatalog();
  return catalogPromise;
}

export async function getBuiltinPluginPackage(
  packageId: string
): Promise<BuiltinPluginPackage | null> {
  const catalog = await loadBuiltinPluginCatalog();
  return catalog.find((item) => item.packageId === packageId) ?? null;
}

async function buildCatalog(): Promise<BuiltinPluginPackage[]> {
  const root = resolve(process.cwd(), "plugins");
  let dirNames: string[];
  try {
    dirNames = (await readdir(root)).filter((name) =>
      name.startsWith("piwork-llm-")
    );
  } catch {
    return [];
  }

  const manager = new ProviderPluginManager();
  const packages: BuiltinPluginPackage[] = [];
  for (const dirName of dirNames) {
    const zipBytes = await zipDirectory(join(root, dirName));
    if (!zipBytes) {
      continue;
    }
    const fileName = `${dirName}.zip`;
    const installation = await manager.install(fileName, zipBytes);
    const definition = await manager.inspectDefinition(installation);
    packages.push({
      definition,
      fileName,
      iconPath: installation.inspection.manifest.assets?.icon ?? null,
      packageId: installation.inspection.packageId,
      providerKey: installation.inspection.providerKey,
      version: installation.inspection.version,
      zipBytes,
    });
  }
  return packages;
}

/** 内置目录也打成 ZIP，确保与上传包经过完全相同的检查和重建链路。 */
async function zipDirectory(dir: string): Promise<Uint8Array | null> {
  const entries: Record<string, Uint8Array> = {};
  for await (const relativePath of glob("**/*", { cwd: dir })) {
    if (relativePath.startsWith("dist/")) {
      continue;
    }
    const absolute = join(dir, relativePath);
    if (!(await stat(absolute)).isFile()) {
      continue;
    }
    entries[relativePath] = new Uint8Array(await readFile(absolute));
  }
  return Object.keys(entries).length > 0
    ? zipSync(entries, { level: 6 })
    : null;
}
