import path from "node:path";

import { listMcpServers } from "@/lib/db/mcp-server-queries";
import {
  buildMcpJsonConfig,
  serializeMcpJsonConfig,
  writeMcpConfigIfChanged,
} from "./mcp-json";

/**
 * 把启用的 MCP 服务同步进聊天工作区 `.mcp.json`（pi 官方发现格式，
 * 见 ./mcp-json.ts）。每次聊天请求都会调用：内容比对后未变则跳过写盘，
 * 管理端变更因此在下一次聊天请求时即生效，无需枚举既有工作区。
 */
export async function syncWorkspaceMcpConfig(workspaceDir: string) {
  const servers = await listMcpServers();
  const serialized = serializeMcpJsonConfig(buildMcpJsonConfig(servers));
  return writeMcpConfigIfChanged(
    path.join(workspaceDir, ".mcp.json"),
    serialized
  );
}
