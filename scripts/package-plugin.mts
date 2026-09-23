/**
 * 将内置插件目录打包为 piwork-llm-<provider>.zip 安装包。
 *
 * 用法：pnpm tsx scripts/package-plugin.ts [plugins/piwork-llm-deepseek]
 * 输出：dist/piwork-llm-<provider>.zip（dist/ 目录按需创建，不入库）
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { zipSync } from "fflate";

async function main() {
  const pluginDirArg = process.argv[2] ?? "plugins/piwork-llm-deepseek";
  const pluginDir = resolve(process.cwd(), pluginDirArg);
  const dirName = basename(pluginDir);
  if (!/^piwork-llm-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(dirName)) {
    throw new Error(
      `Plugin directory name must match piwork-llm-<provider>: ${dirName}`
    );
  }

  const entries: Record<string, Uint8Array> = {};
  await collect(pluginDir, pluginDir, entries);

  const zipBytes = zipSync(entries, { level: 9 });
  const outDir = resolve(process.cwd(), "dist");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `${dirName}.zip`);
  await writeFile(outPath, zipBytes);
  console.log(
    `Packaged ${Object.keys(entries).length} files → ${outPath} (${zipBytes.byteLength} bytes)`
  );
}

async function collect(
  root: string,
  dir: string,
  entries: Record<string, Uint8Array>
): Promise<void> {
  for (const name of await readdir(dir, { withFileTypes: true })) {
    if (name.name === "dist" || name.name === "node_modules") {
      continue;
    }
    const absolute = join(dir, name.name);
    if (name.isDirectory()) {
      // biome-ignore lint/performance/noAwaitInLoops: 目录树需按序递归
      await collect(root, absolute, entries);
      continue;
    }
    if (!name.isFile()) {
      continue;
    }
    const relative = absolute.slice(root.length + 1);
    entries[relative] = new Uint8Array(await readFile(absolute));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
