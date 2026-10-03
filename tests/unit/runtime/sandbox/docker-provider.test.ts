/**
 * DockerSandboxProvider 契约测试（tests/unit/runtime/sandbox/，AGENTS.md 边界）。
 * 需要本机 docker 守护进程（colima/Docker Desktop）；无 docker 或设置
 * PIWORK_SANDBOX_DOCKER_TESTS=0 时整组跳过。workspace 落在仓库
 * .pi/test-sandboxes/（colima 只挂载 /Users，os.tmpdir() 对 VM 不可见）。
 */
import "../../../support/runtime-env";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import test from "node:test";
import {
  type SandboxChannel,
  type SandboxSpec,
  SandboxUnavailableError,
} from "@/lib/runtime/sandbox";
import { DockerSandboxProvider } from "@/lib/runtime/sandbox/docker/provider";

const enabled = process.env.PIWORK_SANDBOX_DOCKER_TESTS !== "0";
const provider = new DockerSandboxProvider();
const dockerReady =
  enabled && process.env.PIWORK_SANDBOX_DOCKER_TESTS !== "1"
    ? await provider.healthy()
    : enabled;
if (enabled && !dockerReady) {
  console.log(
    "docker 不可用，跳过 DockerSandboxProvider 契约组（强制开启：PIWORK_SANDBOX_DOCKER_TESTS=1）"
  );
}

/** 后台收集 channel 输出（测试结束前必须 await 以暴露读取错误） */
function collectStream(channel: SandboxChannel): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const done = (async () => {
    for await (const chunk of channel.read()) {
      chunks.push(chunk);
    }
    const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  })();
  return done;
}

const suite = dockerReady ? test : test.skip;

function spec(overrides: Partial<SandboxSpec> = {}): SandboxSpec {
  return {
    chatId: `0a1b2c3d-${Math.random().toString(36).slice(2, 8)}`,
    egress: { mode: "deny-all" },
    image: "alpine:3.20",
    resource: { cpuCores: 1, memoryMB: 512 },
    runId: `run-${Math.random().toString(36).slice(2, 8)}`,
    ttlSeconds: 600,
    workspaceVolume: { source: "" },
    ...overrides,
  };
}

suite("DockerSandboxProvider contract", async (t) => {
  const workspaces: string[] = [];

  t.after(async () => {
    await Promise.allSettled(
      workspaces.map((dir) => rm(dir, { force: true, recursive: true }))
    );
  });

  const makeSpec = async (overrides: Partial<SandboxSpec> = {}) => {
    const baseDir = path.join(process.cwd(), ".pi", "test-sandboxes");
    await mkdir(baseDir, { recursive: true });
    const workspace = await mkdtemp(path.join(baseDir, "docker-"));
    workspaces.push(workspace);
    return spec({ ...overrides, workspaceVolume: { source: workspace } });
  };

  await t.test("lifecycle: acquire → ready → destroy kill", async () => {
    const handle = await provider.acquire(await makeSpec());
    assert.equal(handle.workspaceRoot, "/workspace");
    assert.equal(await handle.status(), "ready");
    await provider.release(handle, "kill");
    assert.equal(await handle.status(), "destroyed");
  });

  await t.test("channel: cat 字节往返与 stdin EOF 退出", async () => {
    const handle = await provider.acquire(await makeSpec());
    try {
      const channel = await handle.startProcess({ argv: ["cat"] });
      const collected = collectStream(channel);
      const payload = Buffer.from("hello\n中文Δ-bin\x00\x01", "utf8");
      await channel.write(new Uint8Array(payload));
      await channel.endInput();
      const exit = await channel.onExit;
      assert.equal(exit.code, 0);
      assert.deepEqual(Buffer.from(await collected), payload);
    } finally {
      await provider.release(handle, "kill");
    }
  });

  await t.test("channel: 非零退出码经 onExit 表达", async () => {
    const handle = await provider.acquire(await makeSpec());
    try {
      const channel = await handle.startProcess({
        argv: ["sh", "-c", "exit 7"],
      });
      assert.equal((await channel.onExit).code, 7);
    } finally {
      await provider.release(handle, "kill");
    }
  });

  await t.test("files: 嵌套写入与二进制读回", async () => {
    const handle = await provider.acquire(await makeSpec());
    try {
      const bytes = new Uint8Array(512);
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = i % 256;
      }
      await handle.writeFile("piwork/nested/deep/blob.bin", bytes);
      const readBack = await handle.readFile("piwork/nested/deep/blob.bin");
      assert.deepEqual(readBack, bytes);
    } finally {
      await provider.release(handle, "kill");
    }
  });

  await t.test("containment: workspace 外路径被拒绝", async () => {
    const handle = await provider.acquire(await makeSpec());
    try {
      await assert.rejects(async () =>
        handle.writeFile("../escape.txt", new Uint8Array(1))
      );
      await assert.rejects(async () => handle.readFile("/etc/passwd"));
    } finally {
      await provider.release(handle, "kill");
    }
  });

  await t.test("rootfs 只读：/ 不可写（安全基线）", async () => {
    const handle = await provider.acquire(await makeSpec());
    try {
      const channel = await handle.startProcess({
        argv: ["touch", "/probe-ro"],
      });
      assert.notEqual((await channel.onExit).code, 0);
    } finally {
      await provider.release(handle, "kill");
    }
  });

  await t.test("egress deny-all：无网络（wget 失败）", async () => {
    const handle = await provider.acquire(await makeSpec());
    try {
      const channel = await handle.startProcess({
        argv: ["wget", "-T", "3", "-O", "/dev/null", "http://example.com"],
      });
      assert.notEqual((await channel.onExit).code, 0);
    } finally {
      await provider.release(handle, "kill");
    }
  });

  await t.test(
    "egress allowlist：白名单 FQDN 经宿主网关可达；未列 FQDN/外网仍拒绝",
    { timeout: 60_000 },
    async () => {
      // 宿主侧探针服务：必须绑 0.0.0.0（生产同默认——容器经 VM 网关回宿主，
      // 127.0.0.1 对网关不可达）
      const probe = createServer((_req, res) => {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("ok");
      });
      await new Promise<void>((resolve) =>
        probe.listen(0, "0.0.0.0", () => resolve())
      );
      const { port } = probe.address() as AddressInfo;
      const handle = await provider.acquire(
        await makeSpec({
          egress: { fqdns: ["piwork-proxy.local"], mode: "allowlist" },
        })
      );
      try {
        // allowed 对照：白名单 FQDN → --add-host host-gateway → 宿主探针
        const allowed = await handle.startProcess({
          argv: [
            "wget",
            "-T",
            "5",
            "-O",
            "-",
            `http://piwork-proxy.local:${port}/healthz`,
          ],
        });
        const allowedOut = collectStream(allowed);
        assert.equal(
          (await allowed.onExit).code,
          0,
          "白名单 FQDN 应经网关可达"
        );
        assert.equal(Buffer.from(await allowedOut).toString("utf8"), "ok");

        // denied 对照 1：外网域名（--dns 127.0.0.1 掐灭解析；raw-IP 直连
        // 是 docker 档已声明的开发近似残余缺口，见 provider 文件头）
        const external = await handle.startProcess({
          argv: ["wget", "-T", "3", "-O", "/dev/null", "http://example.com"],
        });
        assert.notEqual((await external.onExit).code, 0, "外网应被拒绝");

        // denied 对照 2：未列 FQDN（无 host 别名，dead DNS 不可解析）
        const notListed = await handle.startProcess({
          argv: [
            "wget",
            "-T",
            "3",
            "-O",
            "/dev/null",
            `http://other.local:${port}/healthz`,
          ],
        });
        assert.notEqual((await notListed.onExit).code, 0, "未列 FQDN 应被拒绝");
      } finally {
        await provider.release(handle, "kill");
        probe.closeAllConnections?.();
        await new Promise<void>((resolve) => probe.close(() => resolve()));
      }
    }
  );

  await t.test(
    "renew 无操作成功；attach 已销毁沙箱抛 Unavailable",
    async () => {
      const theSpec = await makeSpec();
      const handle = await provider.acquire(theSpec);
      await handle.renew();
      await provider.release(handle, "kill");
      await assert.rejects(provider.attach(handle.id), SandboxUnavailableError);
    }
  );

  await t.test("attach 存活的沙箱成功", async () => {
    const handle = await provider.acquire(await makeSpec());
    try {
      const reattached = await provider.attach(handle.id);
      assert.equal(await reattached.status(), "ready");
    } finally {
      await provider.release(handle, "kill");
    }
  });

  await t.test("ephemeral workspace：匿名卷私有可写（不共享）", async () => {
    const handle = await provider.acquire(
      await makeSpec({ workspaceVolume: { source: "" } })
    );
    try {
      const channel = await handle.startProcess({
        argv: ["touch", "/workspace/private.txt"],
      });
      assert.equal((await channel.onExit).code, 0);
      const readBack = await handle.readFile("private.txt");
      assert.equal(readBack.byteLength, 0);
    } finally {
      await provider.release(handle, "kill");
    }
  });
});
