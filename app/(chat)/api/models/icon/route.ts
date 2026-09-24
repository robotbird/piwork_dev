import { unzipSync } from "fflate";

import { loadBuiltinPluginCatalog } from "@/lib/model-plugins/builtin-catalog";

/**
 * 模型供应商插件图标：按 provider key 从插件包内（plugins/piwork-llm-*）
 * 的 manifest assets.icon 资源读取，供聊天端模型下拉展示。
 * 仅内置目录中的插件可被命中，路径与 provider key 均受限，无目录穿越风险。
 */

const CONTENT_TYPES: Record<string, string> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

export async function GET(request: Request) {
  const provider = new URL(request.url).searchParams.get("provider") ?? "";
  if (!/^[a-z0-9-]+$/.test(provider)) {
    return new Response("Not Found", { status: 404 });
  }

  const catalog = await loadBuiltinPluginCatalog();
  const plugin = catalog.find((item) => item.providerKey === provider);
  const iconPath = plugin?.iconPath;
  if (!plugin || !iconPath) {
    return new Response("Not Found", { status: 404 });
  }

  const bytes = unzipSync(plugin.zipBytes)[iconPath];
  if (!bytes) {
    return new Response("Not Found", { status: 404 });
  }

  const extension = iconPath.split(".").pop()?.toLowerCase() ?? "";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
    },
  });
}
