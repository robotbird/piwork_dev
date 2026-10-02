import { readFile, writeFile } from "node:fs/promises";

/**
 * pi 官方 mcp.json 格式（pi.dev/docs/latest/mcp；Pi 0.99.0+ 内置 MCP 扩展
 * 在 session_start 连接 server，piwork 由受管 agentDir 的 mcp.json 提供）：
 * `{"mcpServers": {name: {command, args, env} | {url, headers, oauth}}}`。
 * exposure 固定 `direct`：工具像内建工具一样声明给模型，与旧
 * pi-mcp-adapter 行为一致，不要求 codemode。本模块保持零业务依赖
 * （可被 node --test 直接测试）。
 */
export type McpJsonConfig = {
  mcpServers: Record<string, Record<string, unknown>>;
};

export type McpJsonServerInput = {
  args: string[];
  command: string | null;
  description: string;
  enabled: boolean;
  env: Record<string, string>;
  headers: Record<string, string>;
  name: string;
  transport: string;
  url: string | null;
};

/** Pi 内置 MCP 的默认 exposure 是 codemode；平台聊天场景要模型直接可见 */
const PLATFORM_EXPOSURE = "direct";

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
    entry.exposure = PLATFORM_EXPOSURE;
    if (server.description.trim()) {
      entry.description = server.description;
    }
    // 空数组/空对象键省略，保持与 pi 官方示例一致的精简形态
    for (const key of Object.keys(entry).sort()) {
      if (key === "exposure" || key === "description") {
        continue;
      }
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

export type McpConfigFileEntry = {
  config: Record<string, unknown>;
  name: string;
};

export type McpConfigFileResult = {
  errors: string[];
  servers: McpConfigFileEntry[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 解析并粗校验 pi 格式的 mcp.json 内容（对应 pi 0.99.2
 * dist/extensions/mcp/config.js 的 loadMcpConfig 行为：JSON 解析失败、
 * 结构不对、stdio 缺 command、http 缺 url、`-`/`_` 视角重名都进 errors，
 * 其余字段交由 Pi 在连接时校验）。
 */
export function parseMcpConfigString(
  target: string,
  raw: string
): McpConfigFileResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      errors: [
        `${target}: ${error instanceof Error ? error.message : String(error)}`,
      ],
      servers: [],
    };
  }
  if (
    !isRecord(parsed) ||
    (parsed.mcpServers !== undefined && !isRecord(parsed.mcpServers))
  ) {
    return {
      errors: [`${target}: expected an object with an "mcpServers" object`],
      servers: [],
    };
  }
  const servers: McpConfigFileEntry[] = [];
  const errors: string[] = [];
  const namespaces = new Set<string>();
  for (const [name, value] of Object.entries(parsed.mcpServers ?? {})) {
    const config = value;
    if (!isRecord(config)) {
      errors.push(`${target}: server "${name}" must be an object`);
      continue;
    }
    if (typeof config.command !== "string" && typeof config.url !== "string") {
      errors.push(
        `${target}: server "${name}" needs "command" (stdio) or "url" (http)`
      );
      continue;
    }
    // pi 以 `-`→`_` 归一后的名字作为命名空间，归一后重名无法共存
    const namespace = name.replace(/-/g, "_");
    if (namespaces.has(namespace)) {
      errors.push(
        `${target}: server "${name}" conflicts with a same-namespace server`
      );
      continue;
    }
    namespaces.add(namespace);
    servers.push({ config, name });
  }
  return { errors, servers };
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
