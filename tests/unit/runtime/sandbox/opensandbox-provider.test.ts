import "../../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import type {
  SandboxConnectOptions,
  SandboxCreateOptions,
} from "@alibaba-group/opensandbox";
import type {
  SandboxChannel,
  SandboxProvider,
  SandboxSpec,
} from "../../../../lib/runtime/sandbox";
import { SandboxUnavailableError } from "../../../../lib/runtime/sandbox";
import {
  type ManagedSandbox,
  mapSandboxState,
  OpenSandboxProvider,
  type OpenSandboxSandboxFactory,
  resolveInsideWorkspace,
  toNetworkPolicy,
} from "../../../../lib/runtime/sandbox/opensandbox/provider";
import {
  buildLauncherScript,
  EXEC_READY_SENTINEL,
  openPtyExecChannel,
  type PtyExecChannelOptions,
  type PtyWebSocket,
  parsePtyServerMessage,
} from "../../../../lib/runtime/sandbox/opensandbox/pty-channel";

/**
 * OpenSandboxProvider 离线单测：SDK 工厂 / PTY 通道开启器全部注入替身，
 * 不需要真实 OpenSandbox server（真实链路走 gated 契约组
 * PIWORK_SANDBOX_CONTRACT_OPENSANDBOX=1，spec §9）。
 */

function makeSpec(overrides: Partial<SandboxSpec> = {}): SandboxSpec {
  return {
    chatId: "00000000-0000-0000-0000-0000000000bb",
    egress: { mode: "deny-all" },
    image: "pi-runtime:dev",
    resource: { cpuCores: 2, memoryMB: 1024 },
    runId: "00000000-0000-0000-0000-0000000000aa",
    ttlSeconds: 120,
    userId: "00000000-0000-0000-0000-0000000000cc",
    workspaceVolume: { source: "/tmp/ignored" },
    ...overrides,
  };
}

class FakeManagedSandbox implements ManagedSandbox {
  readonly id: string;
  state = "Running";
  infoCalls = 0;
  renewCalls: number[] = [];
  paused = false;
  killed = false;
  closed = false;
  directories: string[] = [];
  written: Array<{ path: string; data: Uint8Array }> = [];
  readPaths: string[] = [];
  readPayload = new TextEncoder().encode("payload");
  endpointPort: number | null = null;
  endpointUrl = "http://sbx.example/sandboxes/sbx-1/proxy/44772";

  constructor(id = "sbx-1") {
    this.id = id;
  }

  getInfo = (): Promise<{ status: { state: string } }> => {
    this.infoCalls += 1;
    return Promise.resolve({ status: { state: this.state } });
  };

  renew = (timeoutSeconds: number): Promise<{ expiresAt: string }> => {
    this.renewCalls.push(timeoutSeconds);
    return Promise.resolve({ expiresAt: new Date().toISOString() });
  };

  pause = (): Promise<void> => {
    this.paused = true;
    this.state = "Paused";
    return Promise.resolve();
  };

  kill = (): Promise<void> => {
    this.killed = true;
    this.state = "Deleted";
    return Promise.resolve();
  };

  close = (): Promise<void> => {
    this.closed = true;
    return Promise.resolve();
  };

  getEndpointUrl = (port: number): Promise<string> => {
    this.endpointPort = port;
    return Promise.resolve(this.endpointUrl);
  };

  readonly files = {
    createDirectories: (entries: Array<{ path: string }>) => {
      this.directories.push(...entries.map((entry) => entry.path));
      return Promise.resolve();
    },
    readBytes: (path: string) => {
      this.readPaths.push(path);
      return Promise.resolve(this.readPayload);
    },
    writeFiles: (
      entries: Array<{ path: string; data?: string | Uint8Array }>
    ) => {
      for (const entry of entries) {
        const data =
          typeof entry.data === "string"
            ? new TextEncoder().encode(entry.data)
            : (entry.data ?? new Uint8Array());
        this.written.push({ data, path: entry.path });
      }
      return Promise.resolve();
    },
  };
}

type ProviderHarness = {
  provider: OpenSandboxProvider;
  factory: FakeFactory;
  sandbox: FakeManagedSandbox;
};

class FakeFactory implements OpenSandboxSandboxFactory {
  created: SandboxCreateOptions[] = [];
  connected: SandboxConnectOptions[] = [];
  createError: Error | null = null;
  connectError: Error | null = null;
  nextSandbox: FakeManagedSandbox = new FakeManagedSandbox();
  openChannelCalls: PtyExecChannelOptions[] = [];
  fakeChannel: SandboxChannel = {
    close: () => Promise.resolve(),
    endInput: () => Promise.resolve(),
    onExit: Promise.resolve({ code: 0, signal: null }),
    async *read() {
      yield* []; // 无输出
    },
    write: () => Promise.resolve(),
  };

  create = (options: SandboxCreateOptions): Promise<ManagedSandbox> => {
    if (this.createError) {
      return Promise.reject(this.createError);
    }
    this.created.push(options);
    return Promise.resolve(this.nextSandbox);
  };

  connect = (options: SandboxConnectOptions): Promise<ManagedSandbox> => {
    if (this.connectError) {
      return Promise.reject(this.connectError);
    }
    this.connected.push(options);
    return Promise.resolve(this.nextSandbox);
  };
}

function makeHarness(): ProviderHarness {
  const factory = new FakeFactory();
  const provider = new OpenSandboxProvider({
    apiKey: "key-1",
    domain: "sbx.example",
    factory,
    openChannel: (options) => {
      factory.openChannelCalls.push(options);
      return Promise.resolve(factory.fakeChannel);
    },
  });
  return { factory, provider, sandbox: factory.nextSandbox };
}

test("buildLauncherScript：哨兵在 exec 前打印，env/argv 全量单引号包裹", () => {
  const script = buildLauncherScript({
    argv: ["node", "/opt/pi/cli.js", "--mode", "rpc"],
    env: { NOTE: "it's quoted", PI_CODING_AGENT_DIR: "/agent dir" },
  });
  const lines = script.split("\n");
  assert.equal(lines[0], "#!/bin/sh");
  assert.ok(
    lines.some((line) =>
      line.includes(`export PI_CODING_AGENT_DIR='/agent dir'`)
    ),
    "env 值带空格应被引号包裹"
  );
  assert.ok(
    lines.some((line) => line.includes(`export NOTE='it'\\''s quoted'`)),
    "env 值内单引号应转义"
  );
  const sentinelIndex = lines.findIndex((line) =>
    line.includes(EXEC_READY_SENTINEL)
  );
  const execIndex = lines.findIndex((line) => line.startsWith("exec "));
  assert.ok(sentinelIndex >= 0 && sentinelIndex < execIndex, "哨兵先于 exec");
  assert.equal(lines[execIndex], "exec 'node' '/opt/pi/cli.js' '--mode' 'rpc'");
  assert.ok(lines[execIndex]?.includes("'--mode' 'rpc'"));
});

test("buildLauncherScript：非法 env 键与空 argv fail-closed", () => {
  assert.throws(
    () => buildLauncherScript({ argv: ["sh"], env: { "BAD KEY": "x" } }),
    /非法 env 键名/
  );
  assert.throws(() => buildLauncherScript({ argv: [] }), /非空 argv/);
});

test("parsePtyServerMessage：二进制与 JSON 帧分类", () => {
  const encoder = new TextEncoder();
  const stdout = parsePtyServerMessage(
    toArrayBuffer(new Uint8Array([0x01, 0x61, 0x0a]))
  );
  assert.equal(stdout.kind, "stdout");
  assert.equal(new TextDecoder().decode(stdout.data), "a\n");

  const stderr = parsePtyServerMessage(
    toArrayBuffer(encoder.encode(`\x02${EXEC_READY_SENTINEL}\n`))
  );
  assert.equal(stderr.kind, "stderr");

  const replay = parsePtyServerMessage(
    toArrayBuffer(new Uint8Array([0x03, 0, 0, 0, 0, 0, 0, 0, 42, 0x62]))
  );
  assert.equal(replay.kind, "replay");
  if (replay.kind === "replay") {
    assert.equal(new TextDecoder().decode(replay.data), "b");
  }

  const json = parsePtyServerMessage('{"type":"exit","exit_code":42}');
  assert.deepEqual(json, {
    kind: "json",
    message: { exit_code: 42, type: "exit" },
  });

  assert.equal(parsePtyServerMessage("not-json").kind, "json");
  assert.equal(parsePtyServerMessage(null).kind, "unknown");
});

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(
    view.byteOffset,
    view.byteOffset + view.byteLength
  ) as ArrayBuffer;
}

test("toNetworkPolicy：deny-all 也显式下发（无 policy = 直通的实测对策）", () => {
  assert.deepEqual(toNetworkPolicy({ mode: "deny-all" }), {
    defaultAction: "deny",
    egress: [],
  });
  assert.deepEqual(
    toNetworkPolicy({
      fqdns: ["api.example.com", "*.npmjs.org"],
      mode: "allowlist",
    }),
    {
      defaultAction: "deny",
      egress: [
        { action: "allow", target: "api.example.com" },
        { action: "allow", target: "*.npmjs.org" },
      ],
    }
  );
});

test("mapSandboxState：OpenSandbox 状态映射，未知态按 degraded", () => {
  assert.equal(mapSandboxState("Creating"), "creating");
  assert.equal(mapSandboxState("Resuming"), "creating");
  assert.equal(mapSandboxState("Running"), "ready");
  assert.equal(mapSandboxState("Pausing"), "paused");
  assert.equal(mapSandboxState("Paused"), "paused");
  assert.equal(mapSandboxState("Error"), "degraded");
  assert.equal(mapSandboxState("Deleting"), "destroyed");
  assert.equal(mapSandboxState("Deleted"), "destroyed");
  assert.equal(mapSandboxState("SomethingNew"), "degraded");
  assert.equal(mapSandboxState(undefined), "degraded");
});

test("resolveInsideWorkspace：相对路径遏制", () => {
  assert.equal(
    resolveInsideWorkspace("/workspace", "a.jsonl"),
    "/workspace/a.jsonl"
  );
  assert.equal(
    resolveInsideWorkspace("/workspace", "piwork/exec-1.sh"),
    "/workspace/piwork/exec-1.sh"
  );
  assert.throws(
    () => resolveInsideWorkspace("/workspace", "../escape.txt"),
    /逃逸/
  );
  assert.throws(
    () => resolveInsideWorkspace("/workspace", "/etc/passwd"),
    /逃逸/
  );
  assert.throws(() => resolveInsideWorkspace("/workspace", ""), /空/);
});

test("acquire：spec 全量映射到 SDK create 参数", async () => {
  const { provider, factory } = makeHarness();
  const handle = await provider.acquire(makeSpec());
  assert.equal(handle.id, "sbx-1");
  assert.equal(handle.workspaceRoot, "/workspace");

  const [options] = factory.created;
  assert.ok(options, "应调用 factory.create");
  assert.equal(options.image, "pi-runtime:dev");
  assert.equal(options.timeoutSeconds, 120);
  assert.deepEqual(options.networkPolicy, {
    defaultAction: "deny",
    egress: [],
  });
  assert.deepEqual(options.metadata, {
    "piwork.chatId": "00000000-0000-0000-0000-0000000000bb",
    "piwork.runId": "00000000-0000-0000-0000-0000000000aa",
    "piwork.userId": "00000000-0000-0000-0000-0000000000cc",
  });
  assert.deepEqual(options.resource, { cpu: "2", memory: "1024Mi" });
  assert.deepEqual(options.connectionConfig, {
    apiKey: "key-1",
    domain: "sbx.example",
    protocol: "http",
    useServerProxy: true,
  });
});

test("acquire 失败 fail-closed 为 SandboxUnavailableError", async () => {
  const { provider, factory } = makeHarness();
  factory.createError = new Error("boom at server");
  await assert.rejects(
    () => provider.acquire(makeSpec()),
    (error: unknown) =>
      error instanceof SandboxUnavailableError && /acquire/.test(error.message)
  );
});

test("attach：externalId 透传 connect，失败同样 fail-closed", async () => {
  const { provider, factory } = makeHarness();
  const handle = await provider.attach("sbx-existing");
  assert.equal(factory.connected[0]?.sandboxId, "sbx-existing");
  assert.equal(handle.id, "sbx-1");

  factory.connectError = Object.assign(new Error("not found"), {
    error: { code: "DOCKER::SANDBOX_NOT_FOUND" },
  });
  await assert.rejects(
    () => provider.attach("sbx-gone"),
    (error: unknown) => error instanceof SandboxUnavailableError
  );
});

test("status：状态映射与 NotFound → destroyed", async () => {
  const { provider, sandbox } = makeHarness();
  const handle = await provider.acquire(makeSpec());
  sandbox.state = "Running";
  assert.equal(await handle.status(), "ready");
  sandbox.state = "Paused";
  assert.equal(await handle.status(), "paused");

  // TTL 到期后 getInfo 报 NotFound → destroyed（不视为平台故障）
  const expired = makeHarness();
  const expiredHandle = await expired.provider.acquire(makeSpec());
  expired.sandbox.getInfo = () =>
    Promise.reject(
      Object.assign(new Error("sandbox not found"), {
        error: { code: "DOCKER::SANDBOX_NOT_FOUND" },
      })
    );
  assert.equal(await expiredHandle.status(), "destroyed");

  const provider2 = new OpenSandboxProvider({
    apiKey: "k",
    domain: "d",
    factory: {
      connect: () =>
        Promise.reject(
          Object.assign(new Error("sandbox not found"), {
            error: { code: "DOCKER::SANDBOX_NOT_FOUND" },
          })
        ),
      create: () => Promise.reject(new Error("unused")),
    },
  });
  await assert.rejects(
    () => provider2.attach("sbx-x"),
    SandboxUnavailableError
  );
});

test("renew：透传 TTL 秒数", async () => {
  const { provider, sandbox } = makeHarness();
  const handle = await provider.acquire(makeSpec({ ttlSeconds: 300 }));
  await handle.renew();
  assert.deepEqual(sandbox.renewCalls, [300]);
});

test("writeFile：嵌套目录自动创建；readFile/writeFile 路径遏制", async () => {
  const { provider, sandbox } = makeHarness();
  const handle = await provider.acquire(makeSpec());
  const content = new TextEncoder().encode("seed\n");
  await handle.writeFile("piwork/session.jsonl", content);
  assert.deepEqual(sandbox.directories, ["/workspace/piwork"]);
  assert.equal(sandbox.written[0]?.path, "/workspace/piwork/session.jsonl");
  assert.ok(Buffer.from(sandbox.written[0]?.data ?? []).equals(content));

  await handle.readFile("piwork/session.jsonl");
  assert.equal(sandbox.readPaths[0], "/workspace/piwork/session.jsonl");

  await assert.rejects(
    () => handle.writeFile("../escape.txt", content),
    /逃逸/
  );
  // readFile 同步抛出（非 async），需 async 包装让 rejects 验证错误形状
  await assert.rejects(async () => handle.readFile("/etc/passwd"), /逃逸/);
});

test("release：kill/pause/keep 策略映射与幂等销毁", async () => {
  const killHarness = makeHarness();
  const killHandle = await killHarness.provider.acquire(makeSpec());
  await killHarness.provider.release(killHandle, "kill");
  assert.ok(killHarness.sandbox.killed);
  assert.ok(killHarness.sandbox.closed);
  assert.equal(await killHandle.status(), "destroyed");
  killHarness.sandbox.kill = () =>
    Promise.reject(new Error("closed client must not be called"));
  await killHarness.provider.release(killHandle, "kill");

  const pauseHarness = makeHarness();
  const pauseHandle = await pauseHarness.provider.acquire(makeSpec());
  await pauseHarness.provider.release(pauseHandle, "pause");
  assert.ok(pauseHarness.sandbox.paused);
  assert.ok(!pauseHarness.sandbox.killed);
  assert.equal(await pauseHandle.status(), "paused");

  const keepHarness = makeHarness();
  const keepHandle = await keepHarness.provider.acquire(makeSpec());
  await keepHarness.provider.release(keepHandle, "keep");
  assert.ok(!keepHarness.sandbox.killed && !keepHarness.sandbox.paused);
  assert.ok(!keepHarness.sandbox.closed, "keep 保留活 handle");

  // kill 遇 NotFound 视为幂等达成
  const idempotent = makeHarness();
  idempotent.sandbox.kill = () =>
    Promise.reject(
      Object.assign(new Error("sandbox not found"), {
        error: { code: "DOCKER::SANDBOX_NOT_FOUND" },
      })
    );
  const idempotentHandle = await idempotent.provider.acquire(makeSpec());
  await idempotent.provider.release(idempotentHandle, "kill");
  assert.equal(await idempotentHandle.status(), "destroyed");
});

test("release：拒绝非本 provider 的 handle", async () => {
  const { provider } = makeHarness();
  await provider.acquire(makeSpec());
  await assert.rejects(
    () =>
      provider.release(
        {
          destroy: () => Promise.resolve(),
          id: "x",
          readFile: () => Promise.resolve(new Uint8Array()),
          renew: () => Promise.resolve(),
          startProcess: () => Promise.reject(new Error("unused")),
          status: () => Promise.resolve("ready"),
          workspaceRoot: "/workspace",
          writeFile: () => Promise.resolve(),
        },
        "kill"
      ),
    /非本 provider/
  );
});

test("startProcess：endpoint 经 SDK 解析、launcher 落 workspace、通道参数齐备", async () => {
  const { provider, factory, sandbox } = makeHarness();
  const handle = await provider.acquire(makeSpec());
  const channel = await handle.startProcess({
    argv: ["node", "/opt/pi/cli.js", "--mode", "rpc"],
    env: { PI_OFFLINE: "1" },
  });
  assert.equal(channel, factory.fakeChannel);
  assert.equal(sandbox.endpointPort, 44_772);

  const launcher = sandbox.written.find((entry) =>
    entry.path.startsWith("/workspace/piwork/exec-")
  );
  assert.ok(launcher, "launcher 应写入 piwork/");
  const script = new TextDecoder().decode(launcher.data);
  assert.ok(script.includes(EXEC_READY_SENTINEL));
  assert.ok(script.includes("exec 'node' '/opt/pi/cli.js' '--mode' 'rpc'"));

  const [channelOptions] = factory.openChannelCalls;
  assert.equal(channelOptions.httpBase, sandbox.endpointUrl);
  assert.deepEqual(channelOptions.headers, { "OPEN-SANDBOX-API-KEY": "key-1" });
  assert.equal(channelOptions.cwd, "/workspace");
  assert.equal(channelOptions.launcherAbsPath, launcher.path);
});

// ---------------------------------------------------------------------------
// PTY 通道（openPtyExecChannel）——FakeWebSocket + FakeFetch，无真实网络
// ---------------------------------------------------------------------------

class FakeWebSocket implements PtyWebSocket {
  binaryType = "blob";
  sent: Array<string | Uint8Array> = [];
  closed = false;
  urls?: { url: string; headers: Record<string, string> };
  private readonly openListeners: Array<(event: { data: unknown }) => void> =
    [];
  private readonly messageListeners: Array<(event: { data: unknown }) => void> =
    [];
  private readonly closeListeners: Array<(event: { data: unknown }) => void> =
    [];

  addEventListener(
    type: "open" | "message" | "close" | "error",
    listener: (event: { data: unknown }) => void
  ): void {
    if (type === "open") {
      this.openListeners.push(listener);
    } else if (type === "message") {
      this.messageListeners.push(listener);
    } else if (type === "close") {
      this.closeListeners.push(listener);
    }
  }

  send(data: string | Uint8Array): void {
    this.sent.push(data);
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const listener of this.closeListeners) {
      listener({ data: undefined });
    }
  }

  // ---- 测试驱动 ----
  simulateOpen() {
    for (const listener of this.openListeners) {
      listener({ data: undefined });
    }
  }

  simulateMessage(data: unknown) {
    for (const listener of this.messageListeners) {
      listener({ data });
    }
  }

  simulateBinary(prefix: number, payload: Uint8Array) {
    const frame = new Uint8Array(payload.length + 1);
    frame[0] = prefix;
    frame.set(payload, 1);
    this.simulateMessage(toArrayBuffer(frame));
  }
}

type RecordedRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
};

function makeFakeFetch(sessionId = "pty-1") {
  const requests: RecordedRequest[] = [];
  const fetchImpl = ((input: string, init?: RequestInit) => {
    requests.push({
      body: typeof init?.body === "string" ? init.body : undefined,
      headers: (init?.headers ?? {}) as Record<string, string>,
      method: init?.method ?? "GET",
      url: String(input),
    });
    const url = String(input);
    if (url.endsWith("/pty") && init?.method === "POST") {
      return Promise.resolve(jsonResponse(200, { session_id: sessionId }));
    }
    if (url.includes(`/pty/${sessionId}`) && init?.method === "DELETE") {
      return Promise.resolve(jsonResponse(200, { ok: true }));
    }
    return Promise.resolve(jsonResponse(404, { error: "not found" }));
  }) as unknown as typeof fetch;
  return { fetchImpl, requests };
}

function jsonResponse(status: number, payload: unknown): Response {
  return {
    json: async () => payload,
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

function channelHarness(overrides: Partial<PtyExecChannelOptions> = {}) {
  const { fetchImpl, requests } = makeFakeFetch();
  const sockets: FakeWebSocket[] = [];
  const factory = (url: string, headers: Record<string, string>) => {
    const socket = new FakeWebSocket();
    socket.urls = { headers, url };
    sockets.push(socket);
    return socket;
  };
  const promise = openPtyExecChannel({
    closeGraceMs: 30,
    cwd: "/workspace",
    fetchImpl,
    headers: { "OPEN-SANDBOX-API-KEY": "key-1" },
    httpBase: "http://sbx.example/sandboxes/sbx-1/proxy/44772/",
    launcherAbsPath: "/workspace/piwork/exec-1.sh",
    startupTimeoutMs: 500,
    webSocketFactory: factory,
    ...overrides,
  });
  return { factory, fetchImpl, promise, requests, sockets };
}

async function driveUntilReady(harness: ReturnType<typeof channelHarness>) {
  await new Promise((resolve) => setImmediate(resolve)); // 等 POST→WS 工厂跑完
  const [socket] = harness.sockets;
  if (!socket) {
    throw new Error("FakeWebSocket 未创建");
  }
  socket.simulateOpen();
  socket.simulateMessage('{"type":"connected"}');
  socket.simulateBinary(
    0x02,
    new TextEncoder().encode(`${EXEC_READY_SENTINEL}\n`)
  );
  return harness.promise;
}

test("PTY 通道：建会话→WS→exec 行→哨兵后可用，帧双向保真", async () => {
  const harness = channelHarness();
  const socketPromise = harness.promise;
  await new Promise((resolve) => setImmediate(resolve)); // 等 POST→WS 工厂跑完

  const [post] = harness.requests;
  assert.equal(post?.method, "POST");
  assert.equal(post?.url, "http://sbx.example/sandboxes/sbx-1/proxy/44772/pty");
  assert.deepEqual(post?.headers, {
    "content-type": "application/json",
    "OPEN-SANDBOX-API-KEY": "key-1",
  });
  assert.deepEqual(JSON.parse(post?.body ?? "{}"), { cwd: "/workspace" });

  const [socket] = harness.sockets;
  assert.ok(socket);
  assert.equal(
    socket.urls?.url,
    "ws://sbx.example/sandboxes/sbx-1/proxy/44772/pty/pty-1/ws?pty=0"
  );
  assert.deepEqual(socket.urls?.headers, { "OPEN-SANDBOX-API-KEY": "key-1" });

  socket.simulateOpen();
  await new Promise((resolve) => setImmediate(resolve)); // exec 行经微任务发出
  // exec 行必须是二进制 0x00 stdin 帧（文本帧会被 server 当 JSON 丢弃）
  const [execFrame] = socket.sent;
  assert.ok(execFrame instanceof Uint8Array, "exec 行应为二进制帧");
  assert.equal(execFrame[0], 0x00);
  assert.equal(
    new TextDecoder().decode(execFrame.subarray(1)),
    "exec sh '/workspace/piwork/exec-1.sh'\n"
  );

  socket.simulateMessage('{"type":"connected"}');
  // 哨兵前的 stderr 噪声不误判为就绪
  socket.simulateBinary(0x02, new TextEncoder().encode("some noise\n"));
  let ready = false;
  const channelPromise = socketPromise.then((opened) => {
    ready = true;
    return opened;
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(!ready, "哨兵未到不应放行通道");

  socket.simulateBinary(
    0x02,
    new TextEncoder().encode(`${EXEC_READY_SENTINEL}\n`)
  );
  const channel = await channelPromise;

  const encoder = new TextEncoder();
  await channel.write(encoder.encode('{"jsonl":1}\n'));
  // exec 行也是二进制帧，write 帧取最后一个
  const lastSent = socket.sent.at(-1);
  assert.ok(lastSent instanceof Uint8Array, "write 应产生二进制 stdin 帧");
  const sentFrame: Uint8Array = lastSent;
  assert.equal(sentFrame[0], 0x00);
  assert.equal(
    new TextDecoder().decode(sentFrame.subarray(1)),
    '{"jsonl":1}\n'
  );

  socket.simulateBinary(0x01, encoder.encode("echo-back"));
  const reader = channel.read()[Symbol.asyncIterator]();
  const { value } = await reader.next();
  assert.equal(new TextDecoder().decode(value), "echo-back");

  socket.simulateMessage('{"type":"exit","exit_code":42}');
  assert.deepEqual(await channel.onExit, { code: 42, signal: null });
  await reader.return?.();
});

test("PTY startup handles a fragmented sentinel and preserves same-frame stderr", async () => {
  const harness = channelHarness();
  await new Promise((resolve) => setImmediate(resolve));
  const [socket] = harness.sockets;
  socket.simulateOpen();
  const encoder = new TextEncoder();
  socket.simulateBinary(0x02, encoder.encode("piwork:exec-"));
  socket.simulateBinary(0x02, encoder.encode("ready\ncommand-stderr"));
  const channel = await harness.promise;
  socket.simulateMessage('{"type":"exit","exit_code":0}');
  assert.ok(channel.readCombined);
  const chunks: Uint8Array[] = [];
  for await (const chunk of channel.readCombined()) {
    chunks.push(chunk);
  }
  assert.equal(Buffer.concat(chunks).toString(), "command-stderr");
  await channel.close();
});

test("PTY tools output preserves stdout/stderr arrival order; RPC read stays stdout-only", async () => {
  await Promise.all(
    [false, true].map(async (combined) => {
      const harness = channelHarness();
      const channel = await driveUntilReady(harness);
      const [socket] = harness.sockets;
      const encoder = new TextEncoder();
      socket.simulateBinary(0x01, encoder.encode("out1"));
      socket.simulateBinary(0x02, encoder.encode("err"));
      socket.simulateBinary(0x01, encoder.encode("out2"));
      socket.simulateMessage('{"type":"exit","exit_code":0}');
      const chunks: Uint8Array[] = [];
      assert.ok(channel.readCombined);
      for await (const chunk of combined
        ? channel.readCombined()
        : channel.read()) {
        chunks.push(chunk);
      }
      assert.equal(
        Buffer.concat(chunks).toString(),
        combined ? "out1errout2" : "out1out2"
      );
      await assert.rejects(
        channel.read()[Symbol.asyncIterator]().next(),
        /single-consumer/
      );
      await channel.close();
    })
  );
});

test("PTY 通道：endInput 映射 SIGTERM 信号帧；close 发 DELETE 并收尾", async () => {
  const harness = channelHarness();
  const channel = await driveUntilReady(harness);
  const [socket] = harness.sockets;

  await channel.endInput();
  assert.equal(
    socket.sent.at(-1),
    JSON.stringify({ signal: "SIGTERM", type: "signal" })
  );

  await channel.close();
  assert.ok(socket.closed);
  const deleteRequest = harness.requests.find(
    (request) => request.method === "DELETE"
  );
  assert.equal(
    deleteRequest?.url,
    "http://sbx.example/sandboxes/sbx-1/proxy/44772/pty/pty-1"
  );
  assert.deepEqual(deleteRequest?.headers, { "OPEN-SANDBOX-API-KEY": "key-1" });
  assert.deepEqual(await channel.onExit, { code: null, signal: "SIGKILL" });

  await channel.write(new Uint8Array(1)).then(
    () => assert.fail("关闭后写应拒绝"),
    (error: unknown) => assert.ok(error instanceof Error)
  );
});

test("PTY 通道：close 前进程已 exit 则不再等待", async () => {
  const harness = channelHarness();
  const channel = await driveUntilReady(harness);
  const [socket] = harness.sockets;
  socket.simulateMessage('{"type":"exit","exit_code":0}');
  await channel.onExit;
  await channel.close();
  assert.deepEqual(await channel.onExit, { code: 0, signal: null });
});

test("PTY 通道：就绪前断开 fail-closed 且清理会话", async () => {
  const harness = channelHarness();
  await new Promise((resolve) => setImmediate(resolve)); // 等 WS 工厂跑完
  const [socket] = harness.sockets;
  if (!socket) {
    throw new Error("FakeWebSocket 未创建");
  }
  socket.simulateOpen();
  socket.simulateMessage('{"type":"connected"}');
  socket.simulateBinary(0x02, new TextEncoder().encode("sh: boom\n"));
  socket.close();

  await assert.rejects(
    harness.promise,
    (error: unknown) =>
      error instanceof SandboxUnavailableError &&
      error.message.includes("sh: boom")
  );
  assert.ok(
    harness.requests.some((request) => request.method === "DELETE"),
    "失败路径仍应清理 PTY 会话"
  );
});

test("PTY 通道：POST /pty 失败直接 SandboxUnavailableError", async () => {
  const failing = (async () =>
    jsonResponse(503, { error: "unavailable" })) as unknown as typeof fetch;
  await assert.rejects(
    openPtyExecChannel({
      cwd: "/workspace",
      fetchImpl: failing,
      headers: {},
      httpBase: "http://sbx.example/sandboxes/sbx-1/proxy/44772",
      launcherAbsPath: "/workspace/piwork/exec-1.sh",
      webSocketFactory: () => new FakeWebSocket(),
    }),
    (error: unknown) =>
      error instanceof SandboxUnavailableError && /503/.test(error.message)
  );
});

test("OpenSandboxProvider 契约套件默认不含 OpenSandbox harness（gated）", () => {
  // 静态约束复述：真实 server 契约组由 PIWORK_SANDBOX_CONTRACT_OPENSANDBOX=1
  // 开启（provider-contract.test.ts）；本文件的替身实现不注册进生产装配。
  const provider: SandboxProvider = new OpenSandboxProvider({
    apiKey: "k",
    domain: "d",
  });
  assert.equal(provider.name, "opensandbox");
});

test("control API uses lifecycle manager, extends existing deadline and closes transport", async () => {
  let expiresAt = new Date(Date.now() + 7_200_000);
  const before = expiresAt.getTime();
  let closes = 0;
  let killed = false;
  const provider = new OpenSandboxProvider({
    domain: "example", apiKey: "test",
    managerFactory: () => ({
      getSandboxInfo: async () => ({ id: "managed", status: { state: "Running" }, expiresAt, createdAt: new Date(), entrypoint: [] }),
      renewSandbox: async (_id, seconds) => { expiresAt = new Date(Date.now() + seconds * 1000); },
      killSandbox: async () => { killed = true; },
      close: async () => { closes++; },
    }),
  });
  assert.equal((await provider.control.inspect("managed"))?.status, "ready");
  await provider.control.extend("managed", 3600);
  assert.ok(expiresAt.getTime() >= before + 3_600_000);
  await provider.control.destroy("managed");
  assert.equal(killed, true); assert.equal(closes, 3);
});

test("control outage is distinct from not-found, kill failure propagates", async () => {
  let missing = true;
  let closes = 0;
  const provider = new OpenSandboxProvider({ domain: "example", apiKey: "test", managerFactory: () => ({
    getSandboxInfo: async () => { throw { statusCode: missing ? 404 : 503 }; },
    renewSandbox: async () => {}, killSandbox: async () => { throw { statusCode: 503 }; }, close: async () => { closes++; },
  }) });
  assert.equal(await provider.control.inspect("missing"), null);
  missing = false;
  await assert.rejects(provider.control.inspect("offline"), SandboxUnavailableError);
  await assert.rejects(provider.control.destroy("offline"), SandboxUnavailableError);
  assert.equal(closes, 3);
});

test("automatic lease renewal preserves a longer manual extension", async () => {
  const { provider, sandbox } = makeHarness();
  sandbox.getInfo = () => Promise.resolve({ status: { state: "Running" }, expiresAt: new Date(Date.now() + 7_200_000) });
  const handle = await provider.acquire(makeSpec());
  await handle.renew();
  assert.deepEqual(sandbox.renewCalls, []);
});
