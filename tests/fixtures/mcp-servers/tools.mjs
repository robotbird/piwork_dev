/**
 * piwork 测试 MCP 服务的共享工具定义(stdio / http 两种传输复用)。
 * 零依赖:不引入 @modelcontextprotocol/sdk,直接拼 JSON-RPC 结果,
 * 用于验证 /management/tools 的 MCP 服务管理端到端是否可用。
 */

export const SERVER_INFO = {
  name: "piwork-test-mcp",
  title: "piwork 测试 MCP 服务",
  version: "1.0.0",
};

export const STARTED_AT = Date.now();

/** MCP 协议版本:客户端请求什么就回什么,未带则用最新已知版本 */
export const LATEST_PROTOCOL_VERSION = "2025-06-18";

export function negotiateProtocolVersion(requested) {
  return typeof requested === "string" && requested
    ? requested
    : LATEST_PROTOCOL_VERSION;
}

export function buildInitializeResult(requestedVersion) {
  return {
    capabilities: { tools: { listChanged: false } },
    instructions:
      "这是 piwork 的测试 MCP 服务,提供 echo / add / server_status 三个工具,用于验证 MCP 链路。",
    protocolVersion: negotiateProtocolVersion(requestedVersion),
    serverInfo: SERVER_INFO,
  };
}

/** 三个工具覆盖:无参健康检查、字符串参数、数值参数 */
export function listTools() {
  return [
    {
      description:
        "原样返回传入的 message,并附带服务器时间戳。用于验证基本往返。",
      inputSchema: {
        properties: {
          message: { description: "要回声的内容", type: "string" },
        },
        required: ["message"],
        type: "object",
      },
      name: "echo",
      title: "回声",
    },
    {
      description: "返回 a + b 的结果。用于验证数值参数 schema 解析。",
      inputSchema: {
        properties: {
          a: { description: "加数", type: "number" },
          b: { description: "被加数", type: "number" },
        },
        required: ["a", "b"],
        type: "object",
      },
      name: "add",
      title: "加法",
    },
    {
      description:
        "返回传输类型、pid、运行时长等运行信息,无参数。用于验证服务可达。",
      inputSchema: { properties: {}, type: "object" },
      name: "server_status",
      title: "服务状态",
    },
  ];
}

/**
 * 执行工具调用,返回 MCP CallToolResult。
 * 未知工具名按协议返回 -32602 错误;工具内部失败用 isError 标记。
 */
export function callTool(name, args, transport) {
  switch (name) {
    case "echo": {
      const message = args?.message;
      if (typeof message !== "string") {
        return {
          content: [{ text: "参数错误:message 必须是字符串", type: "text" }],
          isError: true,
        };
      }
      const now = new Date().toISOString();
      return {
        content: [{ text: `echo: ${message}`, type: "text" }],
        structuredContent: {
          message,
          reply: `echo: ${message}`,
          serverTime: now,
        },
      };
    }
    case "add": {
      const a = args?.a;
      const b = args?.b;
      if (typeof a !== "number" || typeof b !== "number") {
        return {
          content: [{ text: "参数错误:a 和 b 必须是数字", type: "text" }],
          isError: true,
        };
      }
      const result = a + b;
      return {
        content: [{ text: `${a} + ${b} = ${result}`, type: "text" }],
        structuredContent: { a, b, result },
      };
    }
    case "server_status": {
      const status = {
        currentTime: new Date().toISOString(),
        nodeVersion: process.version,
        pid: process.pid,
        server: SERVER_INFO.name,
        transport,
        uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
        version: SERVER_INFO.version,
      };
      return {
        content: [{ text: JSON.stringify(status, null, 2), type: "text" }],
        structuredContent: status,
      };
    }
    default:
      return {
        jsonrpcError: { code: -32_602, message: `未知工具: ${name}` },
      };
  }
}
