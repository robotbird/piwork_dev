import "../../../support/runtime-env";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { SandboxSpec } from "@/lib/runtime/sandbox";
import { startSandboxBridge } from "@/lib/runtime/sandbox/bridge/pump";
import {
  BRIDGE_SOCKET_ENV,
  materializeBridgeShim,
} from "@/lib/runtime/sandbox/bridge/shim";
import { TestSandboxProvider } from "../../../support/sandbox/test-sandbox-provider";

/**
 * Bridge 泵 + shim 契约（spec §6 Phase 2 / §11 D-2）：RpcClient 的官方
 * spawn 形态是 `node <cliPath> --mode rpc ...`，这里以同样方式起 shim，
 * 验证字节保真（JSONL 不被改写）、断线双向传播与进程退出语义。
 * 底座 TestSandboxProvider：startProcess 的子进程是真的，EOF/退出码真实。
 */

function makeSpec(): SandboxSpec {
  return {
    chatId: "00000000-0000-0000-0000-0000000000aa",
    egress: { mode: "deny-all" },
    image: "pi-runtime-test:latest",
    resource: { cpuCores: 1, memoryMB: 512 },
    runId: crypto.randomUUID(),
    ttlSeconds: 300,
    workspaceVolume: { source: "/tmp/unused" },
  };
}

/** 模拟官方 RpcClient.start 的 spawn（rpc-client.js:31-42 同形态） */
function spawnShim(bridge: {
  shimPath: string;
  shimEnv: Record<string, string>;
}) {
  return spawn("node", [bridge.shimPath, "--mode", "rpc"], {
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PATH: process.env.PATH ?? "",
      ...bridge.shimEnv,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function readLines(stream: NodeJS.ReadableStream): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.once("end", () => {
      resolve(
        Buffer.concat(chunks)
          .toString("utf8")
          .split("\n")
          .filter((line) => line.length > 0)
      );
    });
    stream.once("error", reject);
  });
}

function exitOf(child: {
  once: (event: string, cb: (code: number | null) => void) => void;
}) {
  return new Promise<{ code: number | null }>((resolve) =>
    child.once("exit", (code) => resolve({ code }))
  );
}

test("往返字节保真：JSONL 原样穿透 shim↔pump↔沙箱进程", async () => {
  const provider = new TestSandboxProvider();
  const handle = await provider.acquire(makeSpec());
  const bridge = await startSandboxBridge(handle, {
    argv: ["node", "-e", "process.stdin.pipe(process.stdout)"],
  });
  const child = spawnShim(bridge);
  const stderrLines = readLines(child.stderr);
  const stdoutDone = readLines(child.stdout);
  const exit = exitOf(child);
  // 分帧敏感载荷：多行 JSONL + 中文（分帧不得粘连/改写语义）
  const line1 = JSON.stringify({ id: 1, jsonrpc: "2.0", result: { ok: true } });
  const line2 = JSON.stringify({ data: "中文Δ".repeat(50), type: "event" });
  child.stdin.write(`${line1}\n${line2}\n`);
  child.stdin.end();
  const lines = await stdoutDone;
  await exit;
  await bridge.stop();
  await provider.release(handle, "kill");

  assert.deepEqual(lines, [line1, line2]);
  // 诊断通道无噪声（保真失败时 stderr 留有线索）
  assert.equal((await stderrLines).length, 0);
});

test("沙箱进程退出：pump 收尾 socket，shim 干净退出（码不夹带进字节流）", async () => {
  const provider = new TestSandboxProvider();
  const handle = await provider.acquire(makeSpec());
  const bridge = await startSandboxBridge(handle, {
    argv: ["node", "-e", "setTimeout(() => process.exit(7), 50)"],
  });
  const child = spawnShim(bridge);
  const exit = exitOf(child);
  const { code } = await exit;
  await bridge.stop();
  await provider.release(handle, "kill");
  assert.equal(
    code,
    0,
    "EOF 收尾应干净退出；进程死亡由 RpcClient exit 通道表达"
  );
  assert.equal(await handle.status(), "destroyed");
});

test("shim 侧断开（RpcClient 崩溃语义）：停机不悬挂、无孤儿沙箱进程", async () => {
  const provider = new TestSandboxProvider();
  const handle = await provider.acquire(makeSpec());
  const bridge = await startSandboxBridge(handle, {
    argv: ["node", "-e", "process.stdin.pipe(process.stdout)"],
  });
  const child = spawnShim(bridge);
  const exit = exitOf(child);
  // 连接建立后杀死 shim（模拟 RpcClient 侧进程死亡）
  child.stdin.write("ping\n");
  child.kill("SIGKILL");
  await exit;
  // socket close → pump 应已自行 channel.close()；bridge.stop 幂等收尾
  await bridge.stop();
  await provider.release(handle, "kill");
  assert.equal(await handle.status(), "destroyed");
});

test("materializeBridgeShim：缺 socket env 时 shim 立即非零退出", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "piwork-shim-neg-"));
  const shimPath = await materializeBridgeShim(dir);
  const child = spawn("node", [shimPath], {
    env: { NODE_ENV: process.env.NODE_ENV, PATH: process.env.PATH ?? "" },
    stdio: ["ignore", "ignore", "pipe"],
  });
  const stderr = await readLines(child.stderr);
  const { code } = await exitOf(child);
  assert.equal(code, 1);
  assert.ok(
    stderr.some((line) => line.includes(BRIDGE_SOCKET_ENV)),
    `stderr 应含缺失 env 提示，实际 ${JSON.stringify(stderr)}`
  );
});
