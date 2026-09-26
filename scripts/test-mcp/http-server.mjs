#!/usr/bin/env node
/**
 * piwork 测试 MCP 服务 —— Streamable HTTP 传输(pi-mcp-adapter 对 url 型
 * 服务的默认形态,失败会自动降级 sse)。
 * 管理端「新增 MCP 服务」选远程服务(http)时用:
 *   先启动本服务,再填 URL http://127.0.0.1:3100/mcp
 * 端口可用 --port=xxxx 或 PORT 环境变量覆盖;默认只监听 127.0.0.1。
 */
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

import {
  buildInitializeResult,
  callTool,
  listTools,
  SERVER_INFO,
} from "./tools.mjs";

const argPort = process.argv
  .find((arg) => arg.startsWith("--port="))
  ?.slice("--port=".length);
const port = Number(argPort || process.env.PORT || 3100);
const host = process.env.HOST || "127.0.0.1";

/** 无状态实现:会话 id 只在 initialize 响应上发放,不在服务端追踪 */
const sessionId = randomUUID();

function jsonResponse(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Length": Buffer.byteLength(payload),
    "Content-Type": "application/json",
    ...extraHeaders,
  });
  res.end(payload);
}

function handleRequest(message) {
  const { method, params } = message;
  switch (method) {
    case "initialize":
      return {
        headers: { "Mcp-Session-Id": sessionId },
        result: buildInitializeResult(params?.protocolVersion),
      };
    case "ping":
      return { result: {} };
    case "tools/list":
      return { result: { tools: listTools() } };
    case "tools/call": {
      const result = callTool(params?.name, params?.arguments ?? {}, "http");
      if (result.jsonrpcError) {
        return {
          error: {
            code: result.jsonrpcError.code,
            message: result.jsonrpcError.message,
          },
        };
      }
      return { result };
    }
    case "resources/list":
      return { result: { resources: [] } };
    case "prompts/list":
      return { result: { prompts: [] } };
    default:
      return { error: { code: -32_601, message: `未知方法: ${method}` } };
  }
}

const server = createServer((req, res) => {
  if (req.method === "GET" || req.method === "HEAD") {
    // 本服务不主动推送,按规范返回 405 表示不提供 SSE 流
    res.writeHead(405, { Allow: "POST, DELETE" });
    res.end();
    return;
  }
  if (req.method === "DELETE") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405, { Allow: "POST, DELETE" });
    res.end();
    return;
  }

  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("error", () => {
    if (!res.writableEnded) {
      res.destroy();
    }
  });
  req.on("end", () => {
    let message;
    try {
      message = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      jsonResponse(res, 400, {
        error: { code: -32_700, message: "Parse error" },
        id: null,
        jsonrpc: "2.0",
      });
      return;
    }

    const isRequest = message?.id !== undefined && message?.id !== null;
    if (!isRequest) {
      // 通知(如 notifications/initialized):按规范返回 202,无响应体
      res.writeHead(202);
      res.end();
      return;
    }

    try {
      const { result, error, headers } = handleRequest(message);
      const body = { id: message.id, jsonrpc: "2.0" };
      if (error) {
        body.error = error;
      } else {
        body.result = result;
      }
      jsonResponse(res, 200, body, headers);
    } catch (error) {
      jsonResponse(res, 200, {
        error: {
          code: -32_603,
          message: `内部错误: ${error?.message ?? error}`,
        },
        id: message.id,
        jsonrpc: "2.0",
      });
    }
  });
});

server.listen(port, host, () => {
  process.stdout.write(
    `[${SERVER_INFO.name}] HTTP 服务已启动 http://${host}:${port}/mcp pid=${process.pid}\n`
  );
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  });
}
