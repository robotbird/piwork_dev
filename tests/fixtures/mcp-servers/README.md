# 测试 MCP 服务

零依赖纯 Node 实现的 MCP 服务，用来验证 `/management/tools` 的 MCP 服务管理端到端链路
（管理端入库 → 聊天请求同步 `.piwork/pi-agent/mcp.json` → Pi 内置 MCP 扩展在会话启动时连接）。
提供三个工具：

| 工具 | 参数 | 用途 |
| --- | --- | --- |
| `echo` | `{message: string}` | 基本往返（字符串参数） |
| `add` | `{a: number, b: number}` | 数值参数 schema 解析 |
| `server_status` | 无 | 健康检查：传输类型 / pid / 运行时长 |

## stdio 模式（本地服务）

不需要预启动进程，Pi 内置 MCP 扩展会按 `mcp.json` 的 `command` 拉起子进程。

「新增 MCP 服务」弹窗填写：

- 名称：`test-stdio`
- 传输类型：本地服务 (stdio)
- 命令：`node`
- 参数（每行一个）：

```
<项目绝对路径>/tests/fixtures/mcp-servers/stdio-server.mjs
```

## http 模式（远程服务）

先启动服务（默认 `127.0.0.1:3100`，`--port=` 或 `PORT` 可改）：

```sh
node tests/fixtures/mcp-servers/http-server.mjs
```

「新增 MCP 服务」弹窗填写：

- 名称：`test-http`
- 传输类型：远程服务 (http)
- 服务地址：`http://127.0.0.1:3100/mcp`

Streamable HTTP 传输（Pi 内置 MCP 的默认远程形态）；GET 返回 405 表示不提供服务端推送流，
DELETE 返回 204，均符合 MCP 规范。

## 验证

保存后在聊天里发一句（每次新会话启动即连接，`exposure: direct` 的工具直接声明给模型）：

> 用 mcp 工具调用 test-stdio 的 server_status，再用 echo 回一声「链路正常」

同步产物在受管 agentDir `.piwork/pi-agent/mcp.json`（全局发现位置），可对照确认配置落盘形状：

```json
{
  "mcpServers": {
    "test-http": { "exposure": "direct", "url": "http://127.0.0.1:3100/mcp" },
    "test-stdio": { "args": [".../stdio-server.mjs"], "command": "node", "exposure": "direct" }
  }
}
```
