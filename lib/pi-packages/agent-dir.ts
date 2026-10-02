import { resolve } from "node:path";

/**
 * 受管 Pi agentDir：所有 Pi 会话与包安装共用的隔离配置目录
 * （settings.json / mcp.json / mcp-auth.json / mcp.log 都落在这里，
 * 与宿主用户 ~/.pi 完全隔离）。独立成模块避免单元测试拖入
 * manager.ts 的数据库/技能依赖。
 */
export const MANAGED_AGENT_DIR = resolve(process.cwd(), ".piwork", "pi-agent");
