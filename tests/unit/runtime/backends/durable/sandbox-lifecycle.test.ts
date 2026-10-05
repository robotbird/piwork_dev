import "../../../../support/runtime-env";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { getPiModel, getTestFauxHandle } from "../../../../../lib/ai/pi";
import { DurableBackend } from "../../../../../lib/runtime/backends/durable/backend";
import { DurableSandboxBackend } from "../../../../../lib/runtime/backends/durable/sandbox-backend";
import { openOwnedDurableStorage } from "../../../../../lib/runtime/backends/durable/storage";
import type { RuntimeSpec } from "../../../../../lib/runtime/protocol";
import { makeLazySandboxFixture } from "../../../../support/sandbox/lazy-provider";
import { TestSandboxProvider } from "../../../../support/sandbox/test-sandbox-provider";

async function spec(): Promise<RuntimeSpec> {
  return {
    appendSystemPrompt: [],
    chatId: crypto.randomUUID(),
    historyMessages: [],
    model: await getPiModel("deepseek/deepseek-flash"),
    runId: crypto.randomUUID(),
    systemPrompt: "sandbox lifecycle",
    tools: [],
    workspaceDir: "/unused-source",
  };
}

test("managed Durable execution cannot bypass owned storage/authorization", async () => {
  await assert.rejects(
    new DurableBackend({
      executionFactory: () => Promise.reject(new Error("must not run")),
    }).open(await spec()),
    /managed-execution-requires-owned-run/
  );
});

test("durable sandbox abort waits for acquired sandbox destruction, no completed terminal", {
  timeout: 15_000,
}, async (t) => {
  const request = await spec();
  const directory = await mkdtemp(path.join(tmpdir(), "piwork-durable-abort-"));
  const provider = new TestSandboxProvider();
  let notify!: () => void;
  const acquired = new Promise<void>((resolve) => {
    notify = resolve;
  });
  const acquire = provider.acquire.bind(provider);
  provider.acquire = async (allocation) => {
    const handle = await acquire(allocation);
    notify();
    return handle;
  };
  const backend = new DurableSandboxBackend({
    authorize: () => Promise.resolve(),
    authorizeTool: () => Promise.resolve(),
    provider,
    sandboxSpec: (input, runId) =>
      Promise.resolve({
        ...makeLazySandboxFixture().spec,
        chatId: input.chatId,
        runId,
        workspaceVolume: { source: input.workspaceDir ?? "" },
      }),
    storageFactory: () =>
      openOwnedDurableStorage(directory, {
        chatId: request.chatId,
        inputHash: "a".repeat(64),
        runId: request.runId ?? "",
        userId: "00000000-0000-0000-0000-000000000001",
      }),
  });
  getTestFauxHandle()?.setResponses([
    fauxAssistantMessage([fauxToolCall("bash", { command: "sleep 5" })], {
      stopReason: "toolUse",
    }),
    fauxAssistantMessage("unused"),
  ]);
  const session = await backend.open(request);
  t.after(async () => {
    await session.close("test");
    const sandbox = provider.sandbox("test-sbx-1");
    if (sandbox) {
      await rm(sandbox.workspaceDir, { force: true, recursive: true });
    }
    await rm(directory, { force: true, recursive: true });
  });
  await session.send({ text: "run", type: "prompt" });
  await acquired;
  assert.equal((await session.send({ type: "abort" })).ok, true);
  assert.equal(
    await provider.sandbox("test-sbx-1")?.handle.status(),
    "destroyed"
  );
  for await (const event of session.events()) {
    if (event.type === "run.settled" || event.type === "run.failed") {
      assert.ok(event.type !== "run.settled" || event.reason !== "completed");
      break;
    }
  }
});

test("durable sandbox denied open creates neither storage nor execution resources", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "piwork-durable-denied-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  const provider = new TestSandboxProvider();
  const backend = new DurableSandboxBackend({
    authorize: () => Promise.reject(new Error("denied")),
    authorizeTool: () => Promise.reject(new Error("must not execute")),
    provider,
    sandboxSpec: () => Promise.reject(new Error("must not allocate")),
    storageFactory: () => Promise.reject(new Error("must not open storage")),
  });
  await assert.rejects(backend.open(await spec()), /denied/);
  assert.equal(provider.acquiredSpecs.length, 0);
  assert.deepEqual(await readdir(root), []);
});
