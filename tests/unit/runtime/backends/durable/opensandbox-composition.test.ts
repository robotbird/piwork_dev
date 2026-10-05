import "../../../../support/runtime-env";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import {
  createModels,
  type FauxResponseStep,
  fauxAssistantMessage,
  fauxToolCall,
} from "@earendil-works/pi-ai";
import { createRegistry, Harness } from "@earendil-works/pi-durable";
import { getPiModel, getTestFauxHandle } from "../../../../../lib/ai/pi";
import { DurableSandboxBackend } from "../../../../../lib/runtime/backends/durable/sandbox-backend";
import { openOwnedDurableStorage } from "../../../../../lib/runtime/backends/durable/storage";
import type {
  RuntimeEvent,
  RuntimeSession,
  RuntimeSpec,
} from "../../../../../lib/runtime/protocol";
import type { SandboxHandle } from "../../../../../lib/runtime/sandbox";
import { OpenSandboxProvider } from "../../../../../lib/runtime/sandbox/opensandbox/provider";

const enabled = process.env.PIWORK_DURABLE_OPENSANDBOX_TESTS === "1";
async function fixture(t: TestContext, responses: FauxResponseStep[]) {
  const domain = process.env.OPENSANDBOX_DOMAIN;
  const apiKey = process.env.OPENSANDBOX_API_KEY;
  assert.ok(
    domain && apiKey,
    "OpenSandbox domain/key required for explicit contract tests"
  );
  const directory = await mkdtemp(
    path.join(tmpdir(), "piwork-durable-opensandbox-")
  );
  const provider = new OpenSandboxProvider({
    apiKey,
    domain,
    protocol: process.env.OPENSANDBOX_PROTOCOL === "https" ? "https" : "http",
    readyTimeoutSeconds: 60,
  });
  let handle: SandboxHandle | undefined;
  const acquire = provider.acquire.bind(provider);
  provider.acquire = async (allocation) => {
    handle = await acquire(allocation);
    return handle;
  };
  const spec: RuntimeSpec = {
    appendSystemPrompt: [],
    chatId: crypto.randomUUID(),
    historyMessages: [],
    model: await getPiModel("deepseek/deepseek-flash"),
    runId: crypto.randomUUID(),
    systemPrompt: "Use sandbox-relative paths only.",
    tools: [],
    workspaceDir: "/not-mounted-host-path",
  };
  getTestFauxHandle()?.setResponses(responses);
  let session: RuntimeSession | undefined;
  t.after(async () => {
    await session?.close("test").catch(() => undefined);
    if (handle) {
      await provider.release(handle, "kill");
    }
    await rm(directory, { force: true, recursive: true });
  });
  const binding = {
    chatId: spec.chatId,
    inputHash: "a".repeat(64),
    runId: spec.runId ?? "",
    userId: crypto.randomUUID(),
  };
  const storageFactory = () => openOwnedDurableStorage(directory, binding);
  const backend = new DurableSandboxBackend({
    authorize: () => Promise.resolve(),
    authorizeTool: () => Promise.resolve(),
    experimentalOpenSandbox: true,
    provider,
    sandboxSpec: async (request, runId) => ({
      chatId: request.chatId,
      egress: { mode: "deny-all" },
      image: process.env.OPENSANDBOX_IMAGE ?? "pi-runtime:dev",
      resource: { cpuCores: 1, memoryMB: 512 },
      runId,
      ttlSeconds: 120,
      workspaceVolume: { source: request.workspaceDir ?? "" },
    }),
    storageFactory,
  });
  session = await backend.open(spec);
  return {
    handle: () => handle,
    inspect: () => {
      assert.ok(handle);
      return provider.control.inspect(handle.id);
    },
    session,
    storageFactory,
  };
}
async function collect(session: RuntimeSession) {
  const events: RuntimeEvent[] = [];
  for await (const event of session.events()) {
    events.push(event);
    if (event.type === "run.settled" || event.type === "run.failed") {
      break;
    }
  }
  return events;
}
function call(name: string, args: Parameters<typeof fauxToolCall>[1]) {
  return fauxAssistantMessage([fauxToolCall(name, args)], {
    stopReason: "toolUse",
  });
}

test("real OpenSandbox + Durable: bounded atomic write/edit/read and combined shell output", {
  skip: !enabled,
  timeout: 120_000,
}, async (t) => {
  const probe = await fixture(t, [
    call("write", { content: "old", path: "report.txt" }),
    call("edit", {
      edits: [{ newText: "new", oldText: "old" }],
      path: "report.txt",
    }),
    call("bash", {
      command:
        "printf ':shell' >> report.txt; printf stdout; printf stderr >&2",
    }),
    call("read", { path: "report.txt" }),
    fauxAssistantMessage("done"),
  ]);
  await probe.session.send({ text: "create report", type: "prompt" });
  const events = await collect(probe.session);
  assert.deepEqual(
    events
      .filter((event) => event.type === "tool.completed")
      .map((event) => [event.toolName, event.isError]),
    [
      ["write", false],
      ["edit", false],
      ["bash", false],
      ["read", false],
    ]
  );
  assert.equal(events.at(-1)?.type, "run.settled");
  assert.equal(await probe.handle()?.status(), "destroyed");
  assert.equal(await probe.inspect(), null);
  await probe.session.close("inspect");
  const owned = await probe.storageFactory();
  const harness = await Harness.open(
    owned.storage,
    { models: createModels(), registry: createRegistry() },
    BACKGROUND_CONTEXT
  );
  try {
    const root = await harness.root(BACKGROUND_CONTEXT);
    const context = await root.context(BACKGROUND_CONTEXT);
    const transcript = JSON.stringify(context.entries);
    assert.match(transcript, /new:shell/);
    assert.match(transcript, /stdout/);
    assert.match(transcript, /stderr/);
  } finally {
    await harness.close(BACKGROUND_CONTEXT);
    await owned.close();
  }
});

test("real OpenSandbox + Durable: unknown command outcome is killed, failed and never replayed", {
  skip: !enabled,
  timeout: 120_000,
}, async (t) => {
  const probe = await fixture(t, [
    call("bash", { command: "printf once > effect; sleep 5", timeout: 0.2 }),
    fauxAssistantMessage("fake success"),
  ]);
  await probe.session.send({ text: "timeout", type: "prompt" });
  assert.equal((await collect(probe.session)).at(-1)?.type, "run.failed");
  assert.equal(await probe.handle()?.status(), "destroyed");
  assert.equal(await probe.inspect(), null);
  assert.equal(getTestFauxHandle()?.getPendingResponseCount(), 1);
});
