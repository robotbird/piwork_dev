import { readFile, writeFile } from "node:fs/promises";

/**
 * pi 官方 cwd 级 MCP 发现格式（pi.dev/docs/latest/packages；
 * pi-mcp-adapter 读取工作区根目录的 `.mcp.json` 懒连接 server）：
 * `{"mcpServers": {name: {command, args, env} | {url, headers}}}`。
 * 本模块保持零业务依赖（可被 node --test 直接测试）。
 */
export type McpJsonConfig = {
  mcpServers: Record<string, Record<string, unknown>>;
};

export type McpJsonServerInput = {
  args: string[];
  command: string | null;
  enabled: boolean;
  env: Record<string, string>;
  headers: Record<string, string>;
  name: string;
  transport: string;
  url: string | null;
};

function isEmptyContainer(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return (
    typeof value === "object" &&
    value !== null &&
    Object.keys(value).length === 0
  );
}

export function buildMcpJsonConfig(servers: McpJsonServerInput[]) {
  const mcpServers: McpJsonConfig["mcpServers"] = {};
  for (const server of servers) {
    if (!server.enabled) {
      continue;
    }
    const entry: Record<string, unknown> =
      server.transport === "stdio"
        ? {
            args: server.args,
            command: server.command ?? "",
            env: server.env,
          }
        : {
            headers: server.headers,
            url: server.url ?? "",
          };
    // 空数组/空对象键省略，保持与 pi 官方示例一致的精简形态
    for (const key of Object.keys(entry).sort()) {
      if (isEmptyContainer(entry[key])) {
        delete entry[key];
      }
    }
    mcpServers[server.name] = entry;
  }
  // 键名排序保证序列化稳定，旧文件比对不受插入顺序影响
  return {
    mcpServers: Object.fromEntries(
      Object.keys(mcpServers)
        .sort()
        .map((key) => [key, mcpServers[key]])
    ),
  };
}

export function serializeMcpJsonConfig(config: McpJsonConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

/** 内容未变化时跳过写盘；返回是否发生写入。 */
export async function writeMcpConfigIfChanged(
  target: string,
  serialized: string
): Promise<boolean> {
  let existing: string | null = null;
  try {
    existing = await readFile(target, "utf8");
  } catch {
    // 首次生成或旧文件不可读：视为需要写入
  }
  if (existing === serialized) {
    return false;
  }
  await writeFile(target, serialized, "utf8");
  return true;
}
