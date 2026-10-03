import { mkdtemp, writeFile } from "node:fs/promises";
import { createServer, type Socket } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SandboxChannel, SandboxHandle } from "../index";
import { BRIDGE_SHIM_SOURCE, BRIDGE_SOCKET_ENV } from "./shim";

/**
 * 缝 2 服务端泵（spec §4.3）：UDS 服务端 + SandboxChannel 双向拼接。
 * RpcClient 经 cliPath 起 shim（独立进程），shim 连回本 socket；首个连接
 * 到达时才 startProcess（in-sandbox pi），此后字节双向透传：
 * - shim 写侧 EOF（RpcClient 进程退场；官方 stop() 是 SIGTERM/SIGKILL，
 *   故 EOF 即对端死亡）→ endInput() 转发为沙箱内进程 stdin EOF，pi rpc
 *   模式按官方 stdio 语义干净退出——因此 server 必须 allowHalfOpen，
 *   半关闭不触发自动回 FIN（net 默认 false 会瞬间关死双向）；
 * - socket 非正常关闭（destroy/错误）→ channel.close() 杀沙箱内进程；
 * - 沙箱内进程退出 → socket 收尾（shim 见 EOF 干净退出）；
 * - 背压双向传导（write false → pause，drain/写完 → resume）。
 */

export type SandboxBridge = {
  /** RpcClient 的 cliPath：物化后的 shim 绝对路径 */
  shimPath: string;
  /** 传给 RpcClient options.env 的通道定位（宿主侧 env，与沙箱内 env 无关） */
  shimEnv: Record<string, string>;
  /** 幂等停机：断 socket、关 server、杀沙箱内进程 */
  stop: () => Promise<void>;
};

function onceEvent(target: Socket, event: "drain" | "close"): Promise<void> {
  return new Promise((resolve) => target.once(event, resolve));
}

/** 沙箱 → host：流式读 + drain 背压；对端已关时写入失败即止 */
async function pumpChannelToSocket(
  channel: SandboxChannel,
  socket: Socket
): Promise<void> {
  try {
    for await (const chunk of channel.read()) {
      if (!socket.write(chunk)) {
        await Promise.race([
          onceEvent(socket, "drain"),
          onceEvent(socket, "close"),
        ]);
      }
    }
    socket.end();
  } catch {
    socket.destroy();
  }
}

/**
 * 首连接到达后的装配：startProcess → 绑定双向泵。channel 经 onChannel
 * 交还外层（stop/收尾用）；进程退出收尾 socket（shim 见 EOF 干净退出，
 * 退出码由 RpcClient 的 exit 通道表达，不经字节流夹带）。
 */
async function attachSandboxProcess(
  handle: SandboxHandle,
  command: { argv: string[]; cwd?: string; env?: Record<string, string> },
  socket: Socket,
  onChannel: (channel: SandboxChannel) => void
): Promise<void> {
  let channel: SandboxChannel;
  try {
    channel = await handle.startProcess(command);
  } catch {
    socket.destroy();
    return;
  }
  onChannel(channel);

  // host → 沙箱：channel.write 异步，pause/resume 传导背压
  socket.on("data", (chunk) => {
    socket.pause();
    channel
      .write(chunk)
      .catch(() => socket.destroy())
      .finally(() => socket.resume());
  });

  pumpChannelToSocket(channel, socket).catch(() => undefined);
  channel.onExit
    .then(() => {
      socket.end();
    })
    .catch(() => undefined);
}

export async function startSandboxBridge(
  handle: SandboxHandle,
  command: {
    argv: string[];
    cwd?: string;
    env?: Record<string, string>;
  }
): Promise<SandboxBridge> {
  const dir = await mkdtemp(path.join(tmpdir(), "piwork-sbx-bridge-"));
  const socketPath = path.join(dir, "bridge.sock");
  const shimPath = path.join(dir, "shim.mjs");
  await writeFile(shimPath, BRIDGE_SHIM_SOURCE, { mode: 0o755 });

  let channel: SandboxChannel | null = null;
  let client: Socket | null = null;
  let stopped = false;

  // allowHalfOpen：shim 写侧 FIN 只代表 RpcClient 退场（需转发 EOF），
  // 服务端写侧必须保持可写，直到沙箱内进程输出排空
  const server = createServer({ allowHalfOpen: true }, (socket) => {
    if (client || stopped) {
      // 单客户端契约：迟到连接一律拒绝
      socket.destroy();
      return;
    }
    client = socket;
    socket.on("error", () => socket.destroy());
    socket.on("end", () => {
      // 写侧 EOF → 沙箱内 stdin EOF（非 kill：pi rpc 读到 EOF 自行退出）
      channel?.endInput().catch(() => undefined);
    });
    socket.on("close", () => {
      // 非正常关闭（destroy/错误；正常路径 close 前进程已退出）：杀沙箱内
      // 进程，防孤儿 pi
      channel?.close().catch(() => undefined);
    });
    attachSandboxProcess(handle, command, socket, (acquired) => {
      channel = acquired;
    }).catch(() => undefined);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, () => resolve());
  });

  return {
    shimEnv: { [BRIDGE_SOCKET_ENV]: socketPath },
    shimPath,
    stop: async () => {
      stopped = true;
      client?.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await channel?.close().catch(() => undefined);
    },
  };
}
