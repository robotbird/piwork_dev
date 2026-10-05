/**
 * execd PTY pipe 模式通道（spec §11 D-2 定案的落地）。
 *
 * 协议依据 OpenSandbox `components/execd/pkg/web/controller/pty_ws.go`（1.1.0
 * 源码核对）：
 * - C→S 二进制 `0x00`+stdin；C→S 文本 JSON `{type:"stdin"|"signal"|"resize"|"ping"}`
 * - S→C 二进制 `0x01`+stdout、`0x02`+stderr、`0x03`+8B 大端偏移+回放数据
 *   （仅 `since` 重连会出现；本通道不重连，容错并入 stdout）
 * - S→C 文本 JSON `{type:"connected"}` / `{type:"exit",exit_code}`（snake_case，
 *   model/pty_ws.go） / `{type:"error",...}`
 * - **无 stdin EOF 帧**：`endInput()` 映射为 `{type:"signal",signal:"SIGTERM"}`——
 *   与官方 RpcClient.stop() 的 SIGTERM 语义一致（pi rpc 按官方 stdio 语义退出）
 * - server 60s 读超时由任意客户端帧重置；undici 按规范自动回 pong，无需自发心跳
 *
 * 启动握手：`POST {httpBase}/pty {cwd}` 建会话 → WS `?pty=0` → 首行 stdin
 * （**二进制 0x00 帧**；文本帧只承载 JSON 控制消息，非 JSON 被 server 丢弃）
 * `exec sh <launcher>` 替换 shell → 等 stderr 哨兵 `piwork:exec-ready`（launcher
 * 在 exec 前打印）后才放行通道——避免「外层 shell 读走 RPC 字节」的竞态。
 *
 * 鉴权：HTTP 与 WS 握手均带 `OPEN-SANDBOX-API-KEY`（与 SDK 同名 header，
 * server middleware/auth.py 单租户；undici 7.16 WebSocket 支持 headers
 * option，2026-10-02 裸 TCP 实测发送）。
 */

import type { SandboxChannel, SandboxExit } from "../index";
import { SandboxUnavailableError } from "../index";

const FRAME_STDIN = 0x00;
const FRAME_STDOUT = 0x01;
const FRAME_STDERR = 0x02;
const FRAME_REPLAY = 0x03;

/** launcher 就绪哨兵：stderr 首行；宿主见到它才把通道交给调用方 */
export const EXEC_READY_SENTINEL = "piwork:exec-ready";

const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function shQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/**
 * 生成沙箱内 launcher 脚本：env 导出 → stderr 哨兵 → `exec` 目标命令。
 * 纯函数（单测直接覆盖）；env 键与 argv 全量单引号包裹，杜绝注入。
 */
export function buildLauncherScript(command: {
  argv: string[];
  env?: Record<string, string>;
}): string {
  if (command.argv.length === 0) {
    throw new Error("opensandbox: startProcess 需要非空 argv");
  }
  const lines = ["#!/bin/sh"];
  for (const [key, value] of Object.entries(command.env ?? {})) {
    if (!ENV_KEY_PATTERN.test(key)) {
      throw new Error(`opensandbox: 非法 env 键名（shell 标识符）: ${key}`);
    }
    lines.push(`export ${key}=${shQuote(value)}`);
  }
  lines.push(`printf '%s\\n' ${shQuote(EXEC_READY_SENTINEL)} >&2`);
  lines.push(`exec ${command.argv.map(shQuote).join(" ")}`);
  return `${lines.join("\n")}\n`;
}

/** server→client 帧解析结果（纯函数，单测直接覆盖） */
export type PtyServerFrame =
  | { kind: "stdout"; data: Uint8Array }
  | { kind: "stderr"; data: Uint8Array }
  | { kind: "replay"; data: Uint8Array }
  | { kind: "json"; message: unknown }
  | { kind: "unknown" };

export function parsePtyServerMessage(data: unknown): PtyServerFrame {
  if (typeof data === "string") {
    try {
      return { kind: "json", message: JSON.parse(data) };
    } catch {
      return { kind: "json", message: null };
    }
  }
  if (!(data instanceof ArrayBuffer)) {
    return { kind: "unknown" };
  }
  const view = new Uint8Array(data);
  switch (view[0]) {
    case FRAME_STDOUT:
      return { data: view.subarray(1), kind: "stdout" };
    case FRAME_STDERR:
      return { data: view.subarray(1), kind: "stderr" };
    case FRAME_REPLAY:
      // 0x03 前缀 + 8B 大端偏移；不重连时不应出现，容错并入 stdout
      return { data: view.subarray(9), kind: "replay" };
    default:
      return { kind: "unknown" };
  }
}

/** WebSocket 结构性子集：生产用全局 undici WebSocket，单测注入替身 */
export type PtyWebSocket = {
  binaryType: string;
  addEventListener: (
    type: "open" | "message" | "close" | "error",
    listener: (event: { data: unknown }) => void
  ) => void;
  send: (data: string | Uint8Array) => void;
  close: (code?: number) => void;
};

function defaultPtyWebSocketFactory(
  url: string,
  headers: Record<string, string>
): PtyWebSocket {
  // undici 7.16 的非标准 headers option（2026-10-02 裸 TCP 实测会随 upgrade 发出）
  const socket = new (
    WebSocket as unknown as new (
      url: string,
      options?: { headers?: Record<string, string> }
    ) => WebSocket
  )(url, { headers });
  socket.binaryType = "arraybuffer";
  return socket;
}

class ByteQueue {
  private readonly chunks: Array<{ data: Uint8Array; stderr: boolean }> = [];
  private readonly waiters: Array<
    (chunk: { data: Uint8Array; stderr: boolean } | null) => void
  > = [];
  private ended = false;

  push(data: Uint8Array, stderr = false): void {
    const chunk = { data, stderr };
    if (this.ended) {
      return;
    }
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(chunk);
    } else {
      this.chunks.push(chunk);
    }
  }

  end(): void {
    this.ended = true;
    for (const waiter of this.waiters.splice(0)) {
      waiter(null);
    }
  }

  pull(): Promise<{ data: Uint8Array; stderr: boolean } | null> {
    const chunk = this.chunks.shift();
    if (chunk !== undefined) {
      return Promise.resolve(chunk);
    }
    if (this.ended) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }
}

function defer<T = void>() {
  let settled = false;
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = (value) => {
      if (!settled) {
        settled = true;
        res(value);
      }
    };
    reject = (reason) => {
      if (!settled) {
        settled = true;
        rej(reason);
      }
    };
  });
  return {
    promise,
    reject,
    resolve,
    get settled() {
      return settled;
    },
  };
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new SandboxUnavailableError(`opensandbox: ${label}超时 (${ms}ms)`)
      );
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function* readFromQueue(
  queue: ByteQueue,
  combined = false
): AsyncGenerator<Uint8Array> {
  while (true) {
    // biome-ignore lint/performance/noAwaitInLoops: 逐块消费队列即语义本身
    const chunk = await queue.pull();
    if (chunk === null) {
      return;
    }
    if (combined || !chunk.stderr) {
      yield chunk.data;
    }
  }
}

export type PtyExecChannelOptions = {
  /** execd 经 server proxy 的 HTTP base（无尾斜杠），如 `http://host/sandboxes/<id>/proxy/44772` */
  httpBase: string;
  /** HTTP 与 WS 握手头（OPEN-SANDBOX-API-KEY）；单租户 proxy 路径豁免、多租户必验 */
  headers: Record<string, string>;
  /** PTY 会话 cwd（沙箱内绝对路径） */
  cwd: string;
  /** 预先写入沙箱 workspace 的 launcher 绝对路径 */
  launcherAbsPath: string;
  startupTimeoutMs?: number;
  /** close() 先 SIGTERM 后等 exit 帧的宽限（默认 3000ms，对齐官方 stop() 节奏） */
  closeGraceMs?: number;
  fetchImpl?: typeof fetch;
  webSocketFactory?: (
    url: string,
    headers: Record<string, string>
  ) => PtyWebSocket;
};

/**
 * 建立 PTY pipe 通道并启动 launcher：只在 stderr 哨兵到达后才 resolve，
 * 调用方拿到的通道保证 stdin 不会先于目标进程就绪被消费。
 */
export async function openPtyExecChannel(
  options: PtyExecChannelOptions
): Promise<SandboxChannel> {
  const startupTimeoutMs = options.startupTimeoutMs ?? 30_000;
  const fetchImpl = options.fetchImpl ?? fetch;
  const httpBase = options.httpBase.replace(/\/+$/, "");
  const wsFactory = options.webSocketFactory ?? defaultPtyWebSocketFactory;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  // 1. 创建 PTY 会话：POST /pty {cwd} → {session_id}
  const sessionId = await withTimeout(
    (async () => {
      const response = await fetchImpl(`${httpBase}/pty`, {
        body: JSON.stringify({ cwd: options.cwd }),
        headers: { ...options.headers, "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new SandboxUnavailableError(
          `opensandbox: PTY 会话创建失败 (${response.status}): ${body.slice(0, 200)}`
        );
      }
      const payload = (await response.json().catch(() => null)) as {
        session_id?: string;
      } | null;
      if (!payload?.session_id) {
        throw new SandboxUnavailableError(
          "opensandbox: PTY 会话响应缺少 session_id"
        );
      }
      return payload.session_id;
    })(),
    startupTimeoutMs,
    "PTY 会话创建"
  );

  const cleanupSession = async () => {
    await fetchImpl(`${httpBase}/pty/${sessionId}`, {
      headers: { ...options.headers },
      method: "DELETE",
    }).catch(() => undefined);
  };

  // 2. 连接 pipe 模式 WS（?pty=0：无 PTY 分配，字节不污染）
  const wsUrl = `${httpBase.replace(/^http/, "ws")}/pty/${sessionId}/ws?pty=0`;
  const socket = wsFactory(wsUrl, options.headers);

  let exitInfo: SandboxExit | null = null;
  let closed = false;
  let sentinelSeen = false;
  const stdout = new ByteQueue();
  let reading = false;
  const preReadyStderr: string[] = [];
  let readyStderr = Buffer.alloc(0);
  const readyMarker = Buffer.from(`${EXEC_READY_SENTINEL}\n`);
  const opened = defer();
  const ready = defer();
  let exitResolve: ((info: SandboxExit) => void) | null = null;
  const onExit = new Promise<SandboxExit>((resolve) => {
    exitResolve = resolve;
  });

  const finish = (info: SandboxExit) => {
    if (exitInfo) {
      return;
    }
    exitInfo = info;
    stdout.end();
    exitResolve?.(info);
  };

  const failStartup = (error: unknown) => {
    if (!sentinelSeen) {
      ready.reject(error);
    }
  };

  socket.addEventListener("open", () => {
    opened.resolve();
  });
  socket.addEventListener("message", (event) => {
    const frame = parsePtyServerMessage(event.data);
    switch (frame.kind) {
      case "stdout":
      case "replay":
        stdout.push(frame.data);
        return;
      case "stderr": {
        if (sentinelSeen) {
          stdout.push(frame.data, true);
        } else {
          // A WS frame boundary is not a line boundary. Keep a bounded startup
          // buffer and preserve bytes following the marker in the same frame.
          if (readyStderr.length + frame.data.length > 64 * 1024) {
            ready.reject(
              new SandboxUnavailableError(
                "opensandbox: startup stderr limit exceeded"
              )
            );
            return;
          }
          readyStderr = Buffer.concat([readyStderr, frame.data]);
          const marker = readyStderr.indexOf(readyMarker);
          if (marker >= 0) {
            preReadyStderr.push(
              decoder.decode(readyStderr.subarray(0, marker))
            );
            sentinelSeen = true;
            const remainder = readyStderr.subarray(marker + readyMarker.length);
            if (remainder.length) {
              stdout.push(remainder, true);
            }
            readyStderr = Buffer.alloc(0);
            ready.resolve();
          } else {
            preReadyStderr.splice(
              0,
              preReadyStderr.length,
              decoder.decode(readyStderr)
            );
          }
        }
        return;
      }
      case "json": {
        const message = frame.message as {
          type?: string;
          exit_code?: number;
          error?: string;
        } | null;
        if (message?.type === "exit") {
          finish({ code: message.exit_code ?? null, signal: null });
        } else if (message?.type === "error") {
          finish({ code: null, signal: "SIGKILL" });
        }
        return;
      }
      default:
        return;
    }
  });
  socket.addEventListener("close", () => {
    if (!opened.settled) {
      opened.reject(
        new SandboxUnavailableError("opensandbox: PTY WS 握手即断开")
      );
    }
    if (!exitInfo) {
      finish({ code: null, signal: "SIGKILL" });
    }
    failStartup(
      new SandboxUnavailableError("opensandbox: PTY 连接在就绪前关闭")
    );
  });
  socket.addEventListener("error", () => {
    // error 后必有 close；此处不重复收尾
    failStartup(new SandboxUnavailableError("opensandbox: PTY WS 错误"));
  });

  try {
    await withTimeout(opened.promise, startupTimeoutMs, "PTY WS 连接");
    // 3. 首行 stdin（二进制 0x00 帧）：用 launcher 替换 PTY 初始 shell（exec：
    //    不残留中间 shell）。必须走二进制帧——文本帧只承载 JSON 控制消息，
    //    非 JSON 文本被 server 静默丢弃（pty_ws.go ptyHandleTextMsg 实证）。
    const execLine = encoder.encode(
      `exec sh ${shQuote(options.launcherAbsPath)}\n`
    );
    const execFrame = new Uint8Array(execLine.length + 1);
    execFrame[0] = FRAME_STDIN;
    execFrame.set(execLine, 1);
    socket.send(execFrame);
    // 4. 等 launcher 哨兵（stderr）——目标进程已 exec、stdin 归它所有
    await withTimeout(ready.promise, startupTimeoutMs, "launcher 就绪");
  } catch (error) {
    if (error instanceof SandboxUnavailableError) {
      error.message = `${error.message}${describePreReady(preReadyStderr)}`;
    }
    try {
      socket.close(1000);
    } catch {
      // 尽力而为
    }
    await cleanupSession();
    throw error;
  }

  return {
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      if (!exitInfo) {
        // 与官方 RpcClient.stop() 同款节奏：先 SIGTERM，宽限后 DELETE 权威终止
        try {
          socket.send(JSON.stringify({ signal: "SIGTERM", type: "signal" }));
        } catch {
          // 忽略：直接走 DELETE 权威终止
        }
        await Promise.race([
          onExit,
          new Promise((resolve) => {
            setTimeout(resolve, options.closeGraceMs ?? 3000);
          }),
        ]);
      }
      try {
        socket.close(1000);
      } catch {
        // 尽力而为
      }
      await cleanupSession();
      finish({ code: null, signal: "SIGKILL" });
    },
    endInput() {
      if (exitInfo || closed) {
        return Promise.resolve();
      }
      try {
        socket.send(JSON.stringify({ signal: "SIGTERM", type: "signal" }));
      } catch {
        // 进程可能已退出；exit/close 路径自会收尾
      }
      return Promise.resolve();
    },
    onExit,
    async *read() {
      if (reading) {
        throw new Error("opensandbox: channel output is single-consumer");
      }
      reading = true;
      yield* readFromQueue(stdout);
    },
    async *readCombined() {
      if (reading) {
        throw new Error("opensandbox: channel output is single-consumer");
      }
      reading = true;
      yield* readFromQueue(stdout, true);
    },
    write(chunk) {
      if (exitInfo || closed) {
        return Promise.reject(
          new Error("opensandbox: PTY 通道已关闭，拒绝写入")
        );
      }
      const frame = new Uint8Array(chunk.length + 1);
      frame[0] = FRAME_STDIN;
      frame.set(chunk, 1);
      socket.send(frame);
      return Promise.resolve();
    },
  };
}

function describePreReady(preReadyStderr: string[]): string {
  if (preReadyStderr.length === 0) {
    return "";
  }
  return `（stderr: ${preReadyStderr.join("").slice(0, 200).trim()}）`;
}
