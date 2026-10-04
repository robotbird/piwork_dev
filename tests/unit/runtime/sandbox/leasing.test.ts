import "../../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import {
  type SandboxSpec,
  SandboxUnavailableError,
} from "../../../../lib/runtime/sandbox/index";
import { LeasingSandboxProvider } from "../../../../lib/runtime/sandbox/leasing";
import { InMemorySandboxRegistry } from "../../../support/sandbox/in-memory-registry";
import { TestSandboxProvider } from "../../../support/sandbox/test-sandbox-provider";

/**
 * LeasingSandboxProvider 单元测试（opensandbox-integration-spec.md §7 lease
 * 粒度）：chat 复用、attach 失败重建、生命周期记账、fail-closed 传播。
 * 底座用 TestSandboxProvider（本机进程替身），registry 用内存替身——不触 DB。
 */

function makeSpec(overrides: Partial<SandboxSpec> = {}): SandboxSpec {
  return {
    chatId: "00000000-0000-0000-0000-0000000000bb",
    egress: { mode: "deny-all" },
    image: "pi-runtime-test:latest",
    resource: { cpuCores: 1, memoryMB: 512 },
    runId: crypto.randomUUID(),
    ttlSeconds: 60,
    userId: "00000000-0000-0000-0000-0000000000cc",
    workspaceVolume: { source: "/tmp/unused" },
    ...overrides,
  };
}

test("chat 复用：同 chat 二次 acquire 经 attach 命中同一沙箱", async () => {
  const inner = new TestSandboxProvider();
  const registry = new InMemorySandboxRegistry();
  const provider = new LeasingSandboxProvider(inner, registry);

  const first = await provider.acquire(makeSpec());
  const second = await provider.acquire(makeSpec());

  assert.equal(inner.acquiredSpecs.length, 1, "底座只应创建一次沙箱");
  assert.equal(second.id, first.id);
  const acquired = registry.events.filter((e) => e.kind === "acquired");
  assert.equal(acquired.length, 2, "两次 acquire 都记账（更新 lastRunId）");
  assert.notEqual(acquired[0].runId, acquired[1].runId);
});

test("attach 失败：标记 unavailable 并重建，不视为平台故障", async () => {
  const inner = new TestSandboxProvider();
  const registry = new InMemorySandboxRegistry();
  const provider = new LeasingSandboxProvider(inner, registry);

  registry.markReusable("ghost-sbx"); // 注册表有、底座已无（TTL 回收）
  const handle = await provider.acquire(makeSpec());

  assert.notEqual(handle.id, "ghost-sbx");
  assert.ok(
    registry.events.some(
      (e) => e.kind === "unavailable" && e.externalId === "ghost-sbx"
    )
  );
});

test("release(kill)：记账 destroyed 且不再复用；wrap renew 记账", async () => {
  const inner = new TestSandboxProvider();
  const registry = new InMemorySandboxRegistry();
  const provider = new LeasingSandboxProvider(inner, registry);

  const first = await provider.acquire(makeSpec());
  await first.renew();
  await provider.release(first, "kill");
  assert.equal(await first.status(), "destroyed");
  assert.ok(
    registry.events.some((e) => e.kind === "released" && e.policy === "kill")
  );
  assert.ok(
    registry.events.some((e) => e.kind === "renewed"),
    "wrap 的 renew 应记账"
  );

  const second = await provider.acquire(makeSpec());
  assert.notEqual(second.id, first.id, "kill 后不复用，重建新沙箱");
});

test("fail-closed：底座 acquire 失败原样传播 SandboxUnavailableError", async () => {
  const inner = new TestSandboxProvider();
  const provider = new LeasingSandboxProvider(
    inner,
    new InMemorySandboxRegistry()
  );
  inner.failNextAcquires(1);
  await assert.rejects(
    () => provider.acquire(makeSpec()),
    (err: unknown) => err instanceof SandboxUnavailableError
  );
});

test("registration failure destroys partially acquired resource before propagating", async () => {
  const inner = new TestSandboxProvider();
  const registry = new InMemorySandboxRegistry();
  registry.acquired = () => Promise.reject(new Error("registry failed"));
  const provider = new LeasingSandboxProvider(inner, registry, {
    reuse: false,
  });
  await assert.rejects(provider.acquire(makeSpec()), /registry failed/);
  assert.equal(inner.acquiredSpecs.length, 1);
  assert.equal(await inner.sandbox("test-sbx-1")?.handle.status(), "destroyed");
  assert.ok(registry.events.some((event) => event.kind === "released"));
});

test("registration error on reused resource cannot trigger automatic reconstruction", async () => {
  const inner = new TestSandboxProvider();
  const registry = new InMemorySandboxRegistry();
  const provider = new LeasingSandboxProvider(inner, registry);
  const first = await provider.acquire(makeSpec());
  registry.acquired = () =>
    Promise.reject(new SandboxUnavailableError("registry unavailable"));
  await assert.rejects(provider.acquire(makeSpec()), /registry unavailable/);
  assert.equal(inner.acquiredSpecs.length, 1);
  assert.equal(await first.status(), "destroyed");
});

test("failed registration cleanup remains outcome unknown, not a fake destroyed row", async () => {
  const inner = new TestSandboxProvider();
  const registry = new InMemorySandboxRegistry();
  registry.acquired = () => Promise.reject(new Error("registry failed"));
  inner.release = () => Promise.reject(new Error("kill failed"));
  const provider = new LeasingSandboxProvider(inner, registry, {
    reuse: false,
  });
  await assert.rejects(
    provider.acquire(makeSpec()),
    /registration and cleanup failed/
  );
  assert.equal(
    registry.events.filter((event) => event.kind === "released").length,
    0
  );
  await inner.sandbox("test-sbx-1")?.handle.destroy("kill");
});

test("reuse 关闭时每次新建", async () => {
  const inner = new TestSandboxProvider();
  const provider = new LeasingSandboxProvider(
    inner,
    new InMemorySandboxRegistry(),
    { reuse: false }
  );
  const first = await provider.acquire(makeSpec());
  const second = await provider.acquire(makeSpec());
  assert.notEqual(second.id, first.id);
  assert.equal(inner.acquiredSpecs.length, 2);
});
