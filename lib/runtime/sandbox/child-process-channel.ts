import type { ChildProcess } from "node:child_process";
import type { SandboxChannel, SandboxExit } from "./index";

/**
 * 本机 ChildProcess（stdin/stdout 均 pipe）→ SandboxChannel 适配器。
 * TestSandboxProvider（直接 spawn）与 DockerSandboxProvider（spawn
 * `docker exec -i`）共用：背压经 write 回调传导；进程死亡打断 pending
 * write；endInput 半关闭写侧（pi rpc 模式 stdin-EOF 即干净退出的官方
 * stdio 语义，见 seam 注释与 rpc-client.js:89-98 的 stop 语义核对）。
 */
export function createChildProcessChannel(
  child: ChildProcess,
  faultTag: string
): SandboxChannel {
  const onExit = new Promise<SandboxExit>((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  const processFault = onExit.then(() => {
    throw new Error(`${faultTag}:process-exited`);
  });
  // 防 unhandledRejection：无 pending write 时该信号无人消费
  processFault.catch(() => undefined);
  return {
    close: async () => {
      // 先半关闭写侧（容器内进程按 stdin-EOF 自退），再终止本机 CLI 进程；
      // docker exec 场景下 CLI 退场同样会关闭 daemon 侧 stdin 管道
      endStdin(child);
      child.kill("SIGTERM");
      await onExit;
    },
    endInput: () => {
      endStdin(child);
      return Promise.resolve();
    },
    onExit,
    read: () => child.stdout ?? emptyReadable(),
    write: async (chunk) => {
      if (!child.stdin || child.stdin.destroyed) {
        throw new Error(`${faultTag}:stdin-closed`);
      }
      // processFault 仅在 write 等待 drain 期间进程死亡时打断
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          const ok = child.stdin?.write(chunk, (err) =>
            err ? reject(err) : resolve()
          );
          if (ok) {
            resolve();
          }
        }),
        processFault,
      ]);
    },
  };
}

/** stdout 不可用时给出空流（防御性；stdio pipe 下不应发生） */
async function* emptyReadable(): AsyncGenerator<Uint8Array> {
  // 空即语义
}

function endStdin(child: ChildProcess): void {
  if (child.stdin && !child.stdin.destroyed) {
    child.stdin.end();
  }
}
