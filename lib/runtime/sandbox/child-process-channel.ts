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
  // write() rejects via its callback; observe stream error as well so EPIPE is
  // reported to the caller rather than crashing the host with an unhandled event.
  child.stdin?.on("error", () => undefined);
  const onExit = new Promise<SandboxExit>((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
    child.once("error", () => resolve({ code: null, signal: null }));
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
    readCombined: () => combineOutput(child),
    write: async (chunk) => {
      if (!child.stdin || child.stdin.destroyed) {
        throw new Error(`${faultTag}:stdin-closed`);
      }
      // processFault 仅在 write 等待 drain 期间进程死亡时打断
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          child.stdin?.write(chunk, (err) => (err ? reject(err) : resolve()));
        }),
        processFault,
      ]);
    },
  };
}

/** Pull one chunk per stream: no unbounded merge queue and no stderr pollution
 * of RPC stdout. read()/readCombined() are mutually exclusive consumers.
 */
async function* combineOutput(child: ChildProcess): AsyncGenerator<Uint8Array> {
  const streams = [
    child.stdout ?? emptyReadable(),
    child.stderr ?? emptyReadable(),
  ];
  const iterators = streams.map((stream) => stream[Symbol.asyncIterator]());
  const next = (index: number) =>
    iterators[index].next().then(
      (result) => ({ index, result }),
      (error: unknown) => ({ error, index, result: undefined })
    );
  const pending = new Map(
    iterators.map((_iterator, index) => [index, next(index)])
  );
  try {
    while (pending.size) {
      // biome-ignore lint/performance/noAwaitInLoops: pull-based merge must apply backpressure rather than accumulate output.
      const event = await Promise.race(pending.values());
      if ("error" in event) {
        throw event.error;
      }
      if (event.result.done) {
        pending.delete(event.index);
      } else {
        yield event.result.value;
        pending.set(event.index, next(event.index));
      }
    }
  } finally {
    // Wake a pending next() on the other pipe before awaiting return(). This is
    // required when a consumer stops on an output quota while stderr is idle.
    child.stdout?.destroy();
    child.stderr?.destroy();
    await Promise.all(
      iterators.map((iterator) =>
        iterator.return?.(undefined).catch(() => undefined)
      )
    );
  }
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
