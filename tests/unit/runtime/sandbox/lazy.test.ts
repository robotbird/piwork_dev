import assert from "node:assert/strict";
import test from "node:test";
import type { SandboxHandle } from "../../../../lib/runtime/sandbox";
import { LazySandbox } from "../../../../lib/runtime/sandbox/lazy";
import {
  deferred,
  makeLazySandboxFixture,
} from "../../../support/sandbox/lazy-provider";

test("lazy: construction/unused close never provision", async () => {
  const fixture = makeLazySandboxFixture();
  const lazy = new LazySandbox(fixture.provider, fixture.spec);
  assert.equal(fixture.calls.acquire, 0);
  await lazy.close();
  assert.equal(fixture.calls.acquire, 0);
  assert.deepEqual(fixture.calls.releases, []);
  await assert.rejects(lazy.ensure(), /closed/);
});

test("lazy: concurrent ensures acquire once and return the same resource", async () => {
  const fixture = makeLazySandboxFixture();
  const lazy = new LazySandbox(fixture.provider, fixture.spec);
  const handles = await Promise.all(
    Array.from({ length: 20 }, () => lazy.ensure())
  );
  assert.equal(fixture.calls.acquire, 1);
  assert.ok(handles.every((handle) => handle === fixture.handle));
  await lazy.close();
  assert.deepEqual(fixture.calls.releases, ["kill"]);
});

test("lazy: snapshot spec prevents callers mutating the pending allocation", async () => {
  const fixture = makeLazySandboxFixture();
  let source: string | undefined;
  fixture.provider.acquire = (spec) => {
    ({ source } = spec.workspaceVolume);
    assert.equal(spec.resource.memoryMB, 512);
    return Promise.resolve(fixture.handle);
  };
  const lazy = new LazySandbox(fixture.provider, fixture.spec);
  fixture.spec.workspaceVolume.source = "/changed";
  fixture.spec.resource.memoryMB = 999;
  await lazy.ensure();
  assert.equal(source, "/unused");
  await lazy.close();
});

test("lazy: close before scheduled acquisition prevents provision", async () => {
  const fixture = makeLazySandboxFixture();
  const lazy = new LazySandbox(fixture.provider, fixture.spec);
  const pending = assert.rejects(lazy.ensure(), /closed/);
  await lazy.close();
  await pending;
  assert.equal(fixture.calls.acquire, 0);
});

test("lazy: close waits for late provision and releases exactly once", async () => {
  const fixture = makeLazySandboxFixture();
  const allocation = deferred<SandboxHandle>();
  fixture.provider.acquire = () => {
    fixture.calls.acquire += 1;
    return allocation.promise;
  };
  const lazy = new LazySandbox(fixture.provider, fixture.spec);
  const pending = assert.rejects(lazy.ensure(), /closed/);
  await Promise.resolve();
  const close = lazy.close();
  assert.equal(close, lazy.close());
  assert.deepEqual(fixture.calls.releases, []);
  allocation.resolve(fixture.handle);
  await Promise.all([pending, close]);
  assert.deepEqual(fixture.calls.releases, ["kill"]);
  await lazy.close();
  assert.deepEqual(fixture.calls.releases, ["kill"]);
});

test("lazy: pre-aborted run cannot acquire", async () => {
  const fixture = makeLazySandboxFixture();
  const controller = new AbortController();
  controller.abort(new Error("cancelled"));
  const lazy = new LazySandbox(fixture.provider, fixture.spec, {
    signal: controller.signal,
  });
  await assert.rejects(lazy.ensure(), /cancelled/);
  await lazy.close();
  assert.equal(fixture.calls.acquire, 0);
});

test("lazy: abort during provision kills late handle without returning it", async () => {
  const fixture = makeLazySandboxFixture();
  const allocation = deferred<SandboxHandle>();
  fixture.provider.acquire = () => allocation.promise;
  const controller = new AbortController();
  const lazy = new LazySandbox(fixture.provider, fixture.spec, {
    signal: controller.signal,
  });
  const pending = assert.rejects(lazy.ensure(), /cancelled/);
  await Promise.resolve();
  controller.abort(new Error("cancelled"));
  allocation.resolve(fixture.handle);
  await Promise.all([pending, lazy.close()]);
  assert.deepEqual(fixture.calls.releases, ["kill"]);
});

test("lazy: abort after acquisition owns resource cleanup", async () => {
  const fixture = makeLazySandboxFixture();
  const controller = new AbortController();
  const lazy = new LazySandbox(fixture.provider, fixture.spec, {
    signal: controller.signal,
  });
  await lazy.ensure();
  controller.abort();
  await lazy.close();
  assert.deepEqual(fixture.calls.releases, ["kill"]);
  await assert.rejects(lazy.ensure(), { name: "AbortError" });
});

test("lazy: failed acquisition remains failed, no implicit retry/rebuild", async () => {
  const fixture = makeLazySandboxFixture();
  fixture.provider.acquire = () => {
    fixture.calls.acquire += 1;
    return Promise.reject(new Error("outcome unknown"));
  };
  const lazy = new LazySandbox(fixture.provider, fixture.spec);
  await assert.rejects(lazy.ensure(), /outcome unknown/);
  await assert.rejects(lazy.ensure(), /outcome unknown/);
  assert.equal(fixture.calls.acquire, 1);
  await lazy.close();
  assert.deepEqual(fixture.calls.releases, []);
});

test("lazy: missing file and process failure do not rebuild or replay", async () => {
  const fixture = makeLazySandboxFixture();
  fixture.handle.readFile = () => Promise.reject(new Error("file not found"));
  const lazy = new LazySandbox(fixture.provider, fixture.spec);
  const handle = await lazy.ensure();
  await assert.rejects(handle.readFile("missing"), /file not found/);
  await assert.rejects(
    handle.startProcess({ argv: ["sh", "-lc", "work"] }),
    /process unavailable/
  );
  assert.equal(await lazy.ensure(), handle);
  assert.equal(fixture.calls.acquire, 1);
  assert.equal(fixture.calls.process, 1);
  await lazy.close();
});

test("lazy: release failures are observable and do not fabricate successful cleanup", async () => {
  const fixture = makeLazySandboxFixture();
  fixture.provider.release = () => {
    fixture.calls.releases.push("kill");
    return Promise.reject(new Error("destroy unavailable"));
  };
  const lazy = new LazySandbox(fixture.provider, fixture.spec);
  await lazy.ensure();
  await assert.rejects(lazy.close(), /destroy unavailable/);
  await assert.rejects(lazy.close(), /destroy unavailable/);
  await assert.rejects(lazy.ensure(), /closed/);
  assert.deepEqual(fixture.calls.releases, ["kill"]);
});

test("lazy: cancellation retains release failure for lifecycle reporting", async () => {
  const fixture = makeLazySandboxFixture();
  fixture.provider.release = () =>
    Promise.reject(new Error("destroy unavailable"));
  const controller = new AbortController();
  const lazy = new LazySandbox(fixture.provider, fixture.spec, {
    signal: controller.signal,
  });
  await lazy.ensure();
  controller.abort();
  await assert.rejects(lazy.close(), /destroy unavailable/);
});
