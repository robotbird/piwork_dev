import { writeFile } from "node:fs/promises";

/**
 * Bridge shim（spec §4.3 / §6 Phase 2）：RpcClient 官方 spawn 语义是
 * `spawn("node", [cliPath, "--mode", "rpc", ...args])`（rpc-client.js:31-42），
 * cliPath 是唯一注入缝——沙箱模式下它指向本 shim。shim 是纯字节泵：
 * 自身 stdin/stdout ↔ UDS socket，不解析也不改写 JSONL（分帧保真），argv
 * 原样由服务端泵消费（服务端自行构造 in-sandbox argv）。
 *
 * 以源码字符串内嵌并物化到运行时临时目录，而非引用仓库文件：Next/Turbopack
 * 打包会改写模块磁盘路径（tests 记忆：Worker 入口改写同类问题），嵌入字符串
 * 对任何 bundler 免疫。
 */
export const BRIDGE_SOCKET_ENV = "PIWORK_SANDBOX_BRIDGE_SOCKET";

export const BRIDGE_SHIM_SOURCE = `#!/usr/bin/env node
// piwork sandbox bridge shim：RpcClient 子进程 ↔ 沙箱通道的透明泵。
// 字节原样双向转发（含 JSONL 分帧），断线/EOF 如实传播为进程退出。
import net from "node:net";

const socketPath = process.env.${BRIDGE_SOCKET_ENV};
if (!socketPath) {
  process.stderr.write("piwork-bridge: missing ${BRIDGE_SOCKET_ENV}\\n");
  process.exit(1);
}

const socket = net.connect(socketPath);

function shutdown(code) {
  try {
    socket.destroy();
  } catch {
    // 已销毁
  }
  process.exit(code);
}

socket.on("error", (error) => {
  process.stderr.write(\`piwork-bridge: socket error: \${error.message}\\n\`);
  shutdown(1);
});
// 对端正常收尾（EOF/干净关闭）→ 0 退出；非正常关闭走 error 分支
socket.on("close", (hadError) => process.exit(hadError ? 1 : 0));

process.stdin.on("error", (error) => {
  process.stderr.write(\`piwork-bridge: stdin error: \${error.message}\\n\`);
  shutdown(1);
});

// 背压传导：下游 write() 返回 false 即暂停上游，drain 恢复
function pump(readable, writable) {
  readable.on("data", (chunk) => {
    if (!writable.write(chunk)) {
      readable.pause();
    }
  });
  writable.on("drain", () => readable.resume());
  readable.on("end", () => writable.end());
}

pump(process.stdin, socket);
pump(socket, process.stdout);

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));
`;

/** 把 shim 物化为可执行 .mjs 并返回绝对路径（每次会话独立一份） */
export async function materializeBridgeShim(dir: string): Promise<string> {
  const shimPath = `${dir}/shim.mjs`;
  await writeFile(shimPath, BRIDGE_SHIM_SOURCE, { mode: 0o755 });
  return shimPath;
}
