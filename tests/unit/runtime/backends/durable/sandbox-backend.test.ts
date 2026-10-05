import "../../../../support/runtime-env";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import {
  createModels,
  type FauxResponseStep,
  fauxAssistantMessage,
  fauxToolCall,
  Type,
} from "@earendil-works/pi-ai";
import { createRegistry, Harness } from "@earendil-works/pi-durable";
import { getPiModel, getTestFauxHandle } from "../../../../../lib/ai/pi";
import {
  DurableSandboxBackend,
  type DurableSandboxBackendOptions,
  DurableSandboxExecutionDoc,
} from "../../../../../lib/runtime/backends/durable/sandbox-backend";
import { openOwnedDurableStorage } from "../../../../../lib/runtime/backends/durable/storage";
import type {
  RuntimeEvent,
  RuntimeSession,
  RuntimeSpec,
} from "../../../../../lib/runtime/protocol";
import { makeLazySandboxFixture } from "../../../../support/sandbox/lazy-provider";
import { TestSandboxProvider } from "../../../../support/sandbox/test-sandbox-provider";

async function fixture(
  t: TestContext,
  responses: FauxResponseStep[],
  overrides: Partial<DurableSandboxBackendOptions> = {}
) {
  const root = await mkdtemp(path.join(tmpdir(), "piwork-durable-sandbox-"));
  const provider = new TestSandboxProvider();
  const spec: RuntimeSpec = {
    appendSystemPrompt: [],
    chatId: crypto.randomUUID(),
    historyMessages: [],
    model: await getPiModel("deepseek/deepseek-flash"),
    runId: crypto.randomUUID(),
    systemPrompt: "durable sandbox test",
    tools: [],
    workspaceDir: "/unused-source",
  };
  const binding = {
    chatId: spec.chatId,
    inputHash: "a".repeat(64),
    runId: spec.runId ?? "",
    userId: crypto.randomUUID(),
  };
  const storageFactory = () => openOwnedDurableStorage(root, binding);
  const options: DurableSandboxBackendOptions = {
    authorize: () => Promise.resolve(),
    authorizeTool: () => Promise.resolve(),
    provider,
    sandboxSpec: (request, runId) =>
      Promise.resolve({
        ...makeLazySandboxFixture().spec,
        chatId: request.chatId,
        runId,
        workspaceVolume: { source: request.workspaceDir ?? "" },
      }),
    storageFactory,
    ...overrides,
  };
  getTestFauxHandle()?.setResponses(responses);
  let session: RuntimeSession | undefined;
  t.after(async () => {
    await session?.close("test").catch(() => undefined);
    const sandbox = provider.sandbox("test-sbx-1");
    await sandbox?.handle.destroy("kill");
    if (sandbox) {
      await rm(sandbox.workspaceDir, { force: true, recursive: true });
    }
    await rm(root, { force: true, recursive: true });
  });
  return {
    open: async () => {
      session = await new DurableSandboxBackend(options).open(spec);
      return session;
    },
    options,
    provider,
    root,
    spec,
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

test("durable sandbox: official Harness uses all four remote tools and persists transcript/mapping", {
  timeout: 15_000,
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
  const session = await probe.open();
  await session.send({ text: "execute", type: "prompt" });
  const events = await collect(session);
  assert.equal(events.at(-1)?.type, "run.settled");
  assert.equal(
    events[0].type === "run.started" && events[0].runId,
    probe.spec.runId
  );
  assert.equal(
    await probe.provider.sandbox("test-sbx-1")?.handle.status(),
    "destroyed"
  );
  const sandbox = probe.provider.sandbox("test-sbx-1");
  assert.ok(sandbox);
  assert.equal(
    await readFile(path.join(sandbox.workspaceDir, "report.txt"), "utf8"),
    "new:shell"
  );
  assert.equal(
    events.filter((event) => event.type === "tool.completed").length,
    4
  );
  assert.equal(
    (await session.send({ text: "second", type: "prompt" })).ok,
    false
  );
  assert.equal(
    (await session.send({ text: "second", type: "followUp" })).ok,
    false
  );
  await session.close("done");
  assert.ok(
    !(await readdir(path.join(probe.root, probe.spec.runId ?? ""))).includes(
      "owner.lock"
    )
  );
  const owned = await probe.storageFactory();
  const harness = await Harness.open(
    owned.storage,
    { models: createModels(), registry: createRegistry() },
    BACKGROUND_CONTEXT
  );
  try {
    const root = await harness.root(BACKGROUND_CONTEXT);
    const context = await root.context(BACKGROUND_CONTEXT);
    assert.equal(
      context.entries.filter((entry) => entry.kind === "pi.tool-result").length,
      4
    );
    assert.match(JSON.stringify(context.entries), /stdout/);
    assert.match(JSON.stringify(context.entries), /stderr/);
    const mapping = await harness.snapshot(
      DurableSandboxExecutionDoc,
      root.id,
      BACKGROUND_CONTEXT
    );
    assert.equal(mapping?.sandboxId, "test-sbx-1");
    assert.equal(mapping?.stopped, true);
  } finally {
    await harness.close(BACKGROUND_CONTEXT);
    await owned.close();
  }
  await assert.rejects(
    new DurableSandboxBackend(probe.options).open(probe.spec),
    /recovery-not-integrated/
  );
});

test("durable sandbox: text answer creates no container", async (t) => {
  const probe = await fixture(t, [fauxAssistantMessage("hello")]);
  const session = await probe.open();
  await session.send({ text: "hello", type: "prompt" });
  assert.equal((await collect(session)).at(-1)?.type, "run.settled");
  assert.equal(probe.provider.acquiredSpecs.length, 0);
});

test("durable sandbox: revoked tool authorization prevents provision and false success", async (t) => {
  const probe = await fixture(
    t,
    [
      call("bash", { command: "echo no" }),
      fauxAssistantMessage("fake success"),
    ],
    {
      authorizeTool: () => Promise.reject(new Error("grant revoked")),
    }
  );
  const session = await probe.open();
  await session.send({ text: "execute", type: "prompt" });
  assert.equal((await collect(session)).at(-1)?.type, "run.failed");
  assert.equal(probe.provider.acquiredSpecs.length, 0);
  assert.equal(getTestFauxHandle()?.getPendingResponseCount(), 1);
});

test("durable sandbox: acquire failure never falls back to host shell", async (t) => {
  const probe = await fixture(t, [
    call("bash", { command: "echo no" }),
    fauxAssistantMessage("fake success"),
  ]);
  probe.provider.failNextAcquires(1);
  const session = await probe.open();
  await session.send({ text: "execute", type: "prompt" });
  assert.equal((await collect(session)).at(-1)?.type, "run.failed");
  assert.equal(probe.provider.acquiredSpecs.length, 0);
});

test("durable sandbox: timeout kills sandbox and does not replay command", {
  timeout: 10_000,
}, async (t) => {
  const probe = await fixture(t, [
    call("bash", { command: "printf once > effect; sleep 5", timeout: 0.1 }),
    fauxAssistantMessage("fake success"),
  ]);
  const session = await probe.open();
  await session.send({ text: "execute", type: "prompt" });
  assert.equal((await collect(session)).at(-1)?.type, "run.failed");
  assert.equal(
    await probe.provider.sandbox("test-sbx-1")?.handle.status(),
    "destroyed"
  );
  assert.equal(probe.provider.acquiredSpecs.length, 1);
  await session.close("done");
  await assert.rejects(
    new DurableSandboxBackend(probe.options).open(probe.spec),
    /needs-review/
  );
});

test("durable sandbox: cleanup failure prevents success and keeps storage ownership", async (t) => {
  const probe = await fixture(t, [
    call("bash", { command: "echo yes" }),
    fauxAssistantMessage("done"),
  ]);
  probe.provider.release = () => Promise.reject(new Error("kill unavailable"));
  const session = await probe.open();
  await session.send({ text: "execute", type: "prompt" });
  assert.equal((await collect(session)).at(-1)?.type, "run.failed");
  await assert.rejects(session.close("done"), /kill unavailable/);
  await assert.rejects(session.close("again"), /kill unavailable/);
  assert.ok(
    (await readdir(path.join(probe.root, probe.spec.runId ?? ""))).includes(
      "owner.lock"
    )
  );
});

test("durable sandbox: delivery archives before artifact event", async (t) => {
  let archived = false;
  const probe = await fixture(
    t,
    [
      call("write", { content: "report", path: "report.txt" }),
      call("deliver_file", { path: "report.txt" }),
      fauxAssistantMessage("delivered"),
    ],
    {
      publishArtifact: (_spec, input) => {
        assert.equal(Buffer.from(input.content).toString(), "report");
        archived = true;
        return Promise.resolve({
          contentType: input.contentType,
          filename: input.filename,
          url: "/api/files/private-test",
        });
      },
    }
  );
  const session = await probe.open();
  await session.send({ text: "deliver", type: "prompt" });
  const events = await collect(session);
  assert.equal(archived, true);
  const created = events.findIndex(
    (event) => event.type === "artifact.created"
  );
  assert.ok(created >= 0);
  assert.ok(
    events.findIndex(
      (event) =>
        event.type === "tool.completed" && event.toolName === "deliver_file"
    ) > created
  );
  assert.equal(events.at(-1)?.type, "run.settled");
});

test("durable sandbox: allocation/tool/OpenSandbox/production gates fail closed", async (t) => {
  const probe = await fixture(t, []);
  const backend = new DurableSandboxBackend(probe.options);
  await assert.rejects(
    backend.open({ ...probe.spec, workspaceDir: null }),
    /owned-workspace/
  );
  await assert.rejects(
    backend.open({
      ...probe.spec,
      tools: [
        {
          description: "bad",
          execute: async () => ({ content: [], details: undefined }),
          label: "bad",
          name: "bash",
          parameters: Type.Object({}),
        },
      ],
    }),
    /platform-tools-not-approved/
  );
  await assert.rejects(
    new DurableSandboxBackend({
      ...probe.options,
      provider: {
        acquire: probe.provider.acquire.bind(probe.provider),
        attach: probe.provider.attach.bind(probe.provider),
        name: "opensandbox",
        release: probe.provider.release.bind(probe.provider),
      },
    }).open(probe.spec),
    /opensandbox-not-verified/
  );
  const environment = process.env as Record<string, string | undefined>;
  const old = environment.NODE_ENV;
  environment.NODE_ENV = "production";
  try {
    await assert.rejects(backend.open(probe.spec), /production-not-integrated/);
  } finally {
    if (old === undefined) {
      // biome-ignore lint/performance/noDelete: undefined assignment stringifies in process.env
      delete environment.NODE_ENV;
    } else {
      environment.NODE_ENV = old;
    }
  }
});
