import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// node:test 前置环境。必须作为测试文件的第一个 import——ESM 按源序求值静态
// import，本模块先于 lib/ai/pi.ts 执行，其模块级副作用才能生效：
// - PLAYWRIGHT 使 isTestEnvironment 成立（lib/constants.ts）：pi.ts 注册 faux
//   provider、agent-session.ts 设 PI_OFFLINE=1、ensureManagedAgentSettings 短路；
// - UPLOAD_DIR 指向独立 tmp 目录，deliver_file 的 storeFile 本地回退
//   不写进仓库 .uploads/。
process.env.PLAYWRIGHT ??= "1";
process.env.UPLOAD_DIR ??= mkdtempSync(
  path.join(tmpdir(), "piwork-runtime-uploads-")
);
