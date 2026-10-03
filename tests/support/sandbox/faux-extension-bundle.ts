import { fileURLToPath } from "node:url";
import { build } from "esbuild";

/**
 * 把 tests/support/faux-provider-extension.ts 打成自包含 ESM bundle（内存产物，
 * 由调用方写入沙箱 workspace）。真实容器底座（DockerSandboxProvider）里没有
 * 仓库 node_modules，扩展源码中的 `@earendil-works/pi-ai` 与
 * `../../lib/ai/models` 均不可解析——esbuild 全部内联（pi-ai 纯 JS、chatModels
 * 纯静态清单），产物零外部 import，沙箱内 pi 经官方 jiti loader 以 -e 加载
 * （loader.js `jiti.import(path, {default: true})`：ESM .mjs 的默认导出函数
 * 即扩展工厂）。与 LocalRpc 契约测试共用同一份扩展源文件，保证两条链路行为
 * 一致，仅分发方式不同（宿主路径 vs 预打包上传）。
 */

let cachedBundle: Promise<string> | undefined;

export function bundleFauxExtension(): Promise<string> {
  cachedBundle ??= build({
    banner: {
      // CJS 依赖打进 ESM 时 esbuild 不注入 require；防御性提供（pi-ai 当前
      // 纯 ESM，未触发，但版本升级后无需改动这里）
      js: "import { createRequire } from 'node:module';",
    },
    bundle: true,
    entryPoints: [
      fileURLToPath(new URL("../faux-provider-extension.ts", import.meta.url)),
    ],
    format: "esm",
    platform: "node",
    target: "node22",
    write: false,
  }).then((result) => {
    const [output] = result.outputFiles ?? [];
    if (!output) {
      throw new Error("esbuild 未产出 faux extension bundle");
    }
    return output.text;
  });
  return cachedBundle;
}
