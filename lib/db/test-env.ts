import { config } from "dotenv";

// node:test 数据库前置环境。必须作为测试文件的第一个 import——ESM 按源序求值
// 静态 import，本模块先于 agent-run-queries / runtime-event-queries 执行，
// 其模块级 postgres 客户端才能拿到 POSTGRES_URL。
config({ path: ".env.local" });
