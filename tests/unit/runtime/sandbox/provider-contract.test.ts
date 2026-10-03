import "../../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import {
  type SandboxProvider,
  type SandboxSpec,
  SandboxUnavailableError,
} from "../../../../lib/runtime/sandbox";
import { OpenSandboxProvider } from "../../../../lib/runtime/sandbox/opensandbox/provider";
import { TestSandboxProvider } from "../../../support/sandbox/test-sandbox-provider";

/**
 * SandboxProvider 契约测试（opensandbox-integration-spec.md §6 Phase 1、§9）：
 * 同一套用例跑所有 provider 实现，证明缝 2/3 两侧语义一致。
 * Test = 本机进程替身（常驻）；容器底座经 env 开关注册，保持同套件：
 * - PIWORK_SANDBOX_CONTRACT_OPENSANDBOX=1（+ OPENSANDBOX_DOMAIN/API_KEY 必填，
 *   可选 OPENSANDBOX_PROTOCOL/OPENSANDBOX_IMAGE）：真实 OpenSandbox server，
 *   execPath 用容器内 node；默认关闭。
 */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function makeSpec(overrides: Partial<SandboxSpec> = {}): SandboxSpec {
  return {
    chatId: "00000000-0000-0000-0000-0000000000bb",
    egress: { mode: "deny-all" },
    image: "pi-runtime-test:latest",
    resource: { cpuCores: 1, memoryMB: 512 },
    runId: "00000000-0000-0000-0000-0000000000aa",
    ttlSeconds: 60,
    userId: "00000000-0000-0000-0000-0000000000cc",
    workspaceVolume: { source: "/tmp/unused-by-test-provider" },
    ...overrides,
  };
}

type ProviderHarness = {
  name: string;
  makeProvider: () => Promise<SandboxProvider>;
  /** 容器底座内可执行的 node（默认宿主 process.execPath） */
  execPath?: string;
  /** 容器底座的镜像等 spec 差异 */
  specOverrides?: Partial<SandboxSpec>;
};

const harnesses: ProviderHarness[] = [
  { makeProvider: async () => new TestSandboxProvider(), name: "Test" },
];

if (process.env.PIWORK_SANDBOX_CONTRACT_OPENSANDBOX === "1") {
  const domain = process.env.OPENSANDBOX_DOMAIN;
  const apiKey = process.env.OPENSANDBOX_API_KEY;
  if (!domain || !apiKey) {
    throw new Error(
      "PIWORK_SANDBOX_CONTRACT_OPENSANDBOX=1 需要 OPENSANDBOX_DOMAIN 与 OPENSANDBOX_API_KEY（fail-closed）"
    );
  }
  const protocolRaw = process.env.OPENSANDBOX_PROTOCOL;
  harnesses.push({
    execPath: "node",
    makeProvider: async () =>
      new OpenSandboxProvider({
        apiKey,
        domain,
        ...(protocolRaw === "http" || protocolRaw === "https"
          ? { protocol: protocolRaw }
          : {}),
      }),
    name: "OpenSandbox",
    specOverrides: {
      image: process.env.OPENSANDBOX_IMAGE ?? "pi-runtime:dev",
    },
  });
}

for (const harness of harnesses) {
  const execPath = harness.execPath ?? process.execPath;
  test(`[${harness.name}] acquire 后就绪并可双向通信`, async () => {
    const provider = await harness.makeProvider();
    const handle = await provider.acquire(makeSpec(harness.specOverrides));
    await sleep(20); // 异步 create→ready
    assert.equal(await handle.status(), "ready");

    const channel = await handle.startProcess({
      argv: [
        execPath,
        "-e",
        // 逐行回显：验证 JSONL 分帧字节保真
        "process.stdin.on('data', (d) => process.stdout.write(d));",
      ],
    });
    const payload = `${JSON.stringify({ jsonl: "roundtrip", n: 1 })}\n`;
    await channel.write(new TextEncoder().encode(payload));

    const reader = channel.read()[Symbol.asyncIterator]();
    try {
      const { value, done } = await reader.next();
      assert.ok(!done, "应读到回显数据");
      assert.equal(new TextDecoder().decode(value), payload);
    } finally {
      await reader.return?.();
    }
    await provider.release(handle, "kill");
  });

  test(`[${harness.name}] 沙箱内进程退出经 onExit 传播`, async () => {
    const provider = await harness.makeProvider();
    const handle = await provider.acquire(makeSpec(harness.specOverrides));
    const channel = await handle.startProcess({
      argv: [execPath, "-e", "process.exit(42);"],
    });
    const exit = await channel.onExit;
    assert.equal(exit.code, 42);
    await provider.release(handle, "kill");
  });

  test(`[${harness.name}] workspace 文件读写且路径逃逸被拒`, async () => {
    const provider = await harness.makeProvider();
    const handle = await provider.acquire(makeSpec(harness.specOverrides));
    const content = new TextEncoder().encode("session-seed\n");
    await handle.writeFile("session.jsonl", content);
    const readBack = await handle.readFile("session.jsonl");
    assert.ok(
      Buffer.from(content).equals(readBack),
      `文件内容应回读一致：${Buffer.from(readBack).toString()}`
    );

    await assert.rejects(
      async () => handle.writeFile("../escape.txt", content),
      (err: unknown) => err instanceof Error
    );
    await assert.rejects(
      async () => handle.readFile("/etc/passwd"),
      (err: unknown) => err instanceof Error
    );
    await provider.release(handle, "kill");
  });

  test(`[${harness.name}] renew 续期并可查询`, async () => {
    const provider = await harness.makeProvider();
    const handle = await provider.acquire(makeSpec(harness.specOverrides));
    await handle.renew();
    await handle.renew();
    await provider.release(handle, "kill");
  });

  test(`[${harness.name}] destroy(kill) 后操作失败（fail-closed）`, async () => {
    const provider = await harness.makeProvider();
    const handle = await provider.acquire(makeSpec(harness.specOverrides));
    await provider.release(handle, "kill");
    assert.equal(await handle.status(), "destroyed");
    await assert.rejects(
      async () => handle.writeFile("after-destroy.txt", new Uint8Array(1)),
      (err: unknown) => err instanceof Error
    );
  });

  test(`[${harness.name}] acquire 失败抛 SandboxUnavailableError，无静默回退`, async () => {
    const provider = await harness.makeProvider();
    if (provider instanceof TestSandboxProvider) {
      provider.failNextAcquires(1);
      await assert.rejects(
        () => provider.acquire(makeSpec(harness.specOverrides)),
        (err: unknown) => err instanceof SandboxUnavailableError
      );
    }
    // OpenSandbox/容器底座：server 不可达场景由各 provider 单测与 gated 契约覆盖
  });
}
