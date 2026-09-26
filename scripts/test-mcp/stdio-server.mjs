#!/usr/bin/env node
/**
 * piwork 测试 MCP 服务 —— stdio 传输。
 * 管理端「新增 MCP 服务」选本地服务(stdio)时用:
 *   命令 node,参数 <本文件绝对路径>
 * 协议:stdin/stdout 按行分隔的 JSON-RPC 2.0;日志只走 stderr,
 * 绝不能向 stdout 写非协议内容(会被 pi-mcp-adapter 当消息解析失败)。
 */
import readline from "node:readline";

import {
  buildInitializeResult,
  callTool,
  listTools,
  SERVER_INFO,
} from "./tools.mjs";

const rl = readline.createInterface({ input: process.stdin });

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
  send({ id, jsonrpc: "2.0", result });
}

function replyError(id, code, message) {
  send({ error: { code, message }, id, jsonrpc: "2.0" });
}

rl.on("line", (line) => {
  const text = line.trim();
  if (!text) {
    return;
  }
  let message;
  try {
    message = JSON.parse(text);
  } catch {
    send({
      error: { code: -32_700, message: "Parse error" },
      id: null,
      jsonrpc: "2.0",
    });
    return;
  }

  const { id, method, params } = message;
  const isRequest = id !== undefined && id !== null;

  try {
    switch (method) {
      case "initialize":
        reply(id, buildInitializeResult(params?.protocolVersion));
        break;
      case "notifications/initialized":
      case "notifications/cancelled":
      case "notifications/roots/list_changed":
        // 通知无需回应
        break;
      case "ping":
        reply(id, {});
        break;
      case "tools/list":
        reply(id, { tools: listTools() });
        break;
      case "tools/call": {
        const result = callTool(params?.name, params?.arguments ?? {}, "stdio");
        if (result.jsonrpcError) {
          replyError(id, result.jsonrpcError.code, result.jsonrpcError.message);
        } else {
          reply(id, result);
        }
        break;
      }
      case "resources/list":
        reply(id, { resources: [] });
        break;
      case "prompts/list":
        reply(id, { prompts: [] });
        break;
      default:
        if (isRequest) {
          replyError(id, -32_601, `未知方法: ${method}`);
        }
    }
  } catch (error) {
    if (isRequest) {
      replyError(id, -32_603, `内部错误: ${error?.message ?? error}`);
    }
    process.stderr.write(`处理 ${method} 出错: ${error?.stack ?? error}\n`);
  }
});

process.on("SIGTERM", () => {
  rl.close();
  process.exit(0);
});

process.stderr.write(
  `[${SERVER_INFO.name}] stdio 服务已启动 pid=${process.pid}\n`
);
