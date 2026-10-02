import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import type {
  LoadedMcpConfig,
  McpServerEntry,
} from "@earendil-works/pi-coding-agent";

import { listMcpServers } from "@/lib/db/mcp-server-queries";
import { MANAGED_AGENT_DIR } from "@/lib/pi-packages/agent-dir";
import {
  buildMcpJsonConfig,
  parseMcpConfigString,
  serializeMcpJsonConfig,
  writeMcpConfigIfChanged,
} from "./mcp-json";

/**
 * 管理端 MCP 配置 ↔ Pi 内置 MCP 扩展（0.99.0+ builtin:mcp）的桥接。
 *
 * - 写侧：把启用的服务同步进受管 agentDir 的 `mcp.json`（Pi 全局发现位置，
 *   见 ./mcp-json.ts）。每次聊天请求都会调用，内容未变不写盘，管理端变更
 *   在下一次聊天请求时生效。
 * - 读侧：`loadPiworkMcpConfig` 作为 `createMcpExtension` 的自定义
 *   `loadConfig` 注入 Pi 会话——只认受管 agentDir 的 `mcp.json`，刻意忽略
 *   会话 cwd 的项目级 `.pi/mcp.json`（SDK 默认 projectTrusted=true 会读它，
 *   聊天工作区里的文件不得注入 MCP 服务）。
 */

export const MANAGED_MCP_CONFIG_PATH = resolve(MANAGED_AGENT_DIR, "mcp.json");

// 串行写队列:并发聊天请求同时同步时避免读-比-写交错
let syncQueue: Promise<unknown> = Promise.resolve();

function enqueueSync<T>(operation: () => Promise<T>): Promise<T> {
  const next = syncQueue.then(operation, operation);
  syncQueue = next.catch(() => undefined);
  return next;
}

export function syncManagedAgentMcpConfig(): Promise<boolean> {
  return enqueueSync(async () => {
    const servers = await listMcpServers();
    const serialized = serializeMcpJsonConfig(buildMcpJsonConfig(servers));
    await mkdir(MANAGED_AGENT_DIR, { recursive: true });
    return writeMcpConfigIfChanged(MANAGED_MCP_CONFIG_PATH, serialized);
  });
}

/**
 * Pi 内置 MCP 扩展的 loadConfig：同步读受管 agentDir 的 mcp.json。
 * 路径参数仅供测试注入；接线时用 `() => loadPiworkMcpConfig()` 包一层，
 * 避免把扩展上下文误当路径传入。
 */
export function loadPiworkMcpConfig(
  target = MANAGED_MCP_CONFIG_PATH
): LoadedMcpConfig {
  let raw: string | null = null;
  try {
    raw = readFileSync(target, "utf8");
  } catch {
    // 尚未同步过:按无服务处理,写侧会在聊天请求时生成
  }
  if (raw === null) {
    return { errors: [], servers: [] };
  }
  const { errors, servers } = parseMcpConfigString(target, raw);
  const entries: McpServerEntry[] = servers.map((server) => ({
    // 文件由本模块写侧生成,形状受 mcp-json.ts 管控,粗校验后直通
    config: server.config as unknown as McpServerEntry["config"],
    name: server.name,
    scope: "global",
    source: target,
  }));
  return { errors, servers: entries };
}
