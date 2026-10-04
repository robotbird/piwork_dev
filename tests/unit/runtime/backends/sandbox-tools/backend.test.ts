import "../../../../support/runtime-env";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import test, { type TestContext } from "node:test";
import {
  type FauxResponseStep,
  fauxAssistantMessage,
  fauxText,
  fauxToolCall,
  Type,
} from "@earendil-works/pi-ai";
import { getPiModel, getTestFauxHandle } from "../../../../../lib/ai/pi";
import {
  SandboxToolsBackend,
  type SandboxToolsBackendOptions,
} from "../../../../../lib/runtime/backends/sandbox-tools/backend";
import type {
  RuntimeEvent,
  RuntimeSession,
  RuntimeSpec,
} from "../../../../../lib/runtime/protocol";
import { makeLazySandboxFixture } from "../../../../support/sandbox/lazy-provider";
import { TestSandboxProvider } from "../../../../support/sandbox/test-sandbox-provider";

async function fixture(
  t: TestContext,
  steps: FauxResponseStep[],
  authorize?: () => Promise<void>,
  publishArtifact?: SandboxToolsBackendOptions["publishArtifact"]
) {
  const model = await getPiModel("deepseek/deepseek-flash");
  const faux = getTestFauxHandle();
  assert.ok(faux);
  faux.setResponses(steps);
  const provider = new TestSandboxProvider();
  const backend = new SandboxToolsBackend({
    authorizeTool: authorize ?? (() => Promise.resolve()),
    provider,
    publishArtifact,
    sandboxSpec: (request, runId) =>
      Promise.resolve({
        ...makeLazySandboxFixture().spec,
        chatId: request.chatId,
        runId,
        workspaceVolume: { source: request.workspaceDir ?? "" },
      }),
  });
  const spec: RuntimeSpec = {
    appendSystemPrompt: [],
    chatId: "chat-tools-contract",
    historyMessages: [],
    model,
    runId: crypto.randomUUID(),
    systemPrompt: "tools adapter test",
    tools: [],
    workspaceDir: "/unused-test-provider-source",
  };
  let session: RuntimeSession | undefined;
  t.after(async () => {
    if (session) {
      await session.close("test").catch(() => undefined);
    }
    const directory = provider.sandbox("test-sbx-1")?.workspaceDir;
    if (directory) {
      await rm(directory, { force: true, recursive: true });
    }
  });
  return {
    backend,
    open: async () => {
      session = await backend.open(spec);
      return session;
    },
    provider,
    spec,
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

test("tools backend: pure response within execution lane still provisions no sandbox", async (t) => {
  const probe = await fixture(t, [fauxAssistantMessage([fauxText("hello")])]);
  const session = await probe.open();
  assert.deepEqual(await session.send({ text: "hello", type: "prompt" }), {
    ok: true,
  });
  const events = await collect(session);
  assert.equal(events.at(-1)?.type, "run.settled");
  assert.equal(probe.provider.acquiredSpecs.length, 0);
  assert.equal(events[0].type, "run.started");
  if (events[0].type === "run.started") {
    assert.equal(events[0].runId, probe.spec.runId);
  }
  assert.equal(
    (await session.send({ text: "second", type: "prompt" })).ok,
    false
  );
});

test("tools backend: unsupported prompt images are rejected before SDK image conversion", async (t) => {
  const probe = await fixture(t, [fauxAssistantMessage([fauxText("hello")])]);
  const session = await probe.open();
  const rejected = await session.send({
    images: [{ data: "aGVsbG8=", mimeType: "image/svg+xml", type: "image" }],
    text: "image",
    type: "prompt",
  });
  assert.equal(rejected.ok, false);
  assert.match(rejected.error ?? "", /unsupported-or-oversized-image/);
  const many = await session.send({
    images: Array.from({ length: 6 }, () => ({
      data: "aGVsbG8=",
      mimeType: "image/png",
      type: "image" as const,
    })),
    text: "images",
    type: "prompt",
  });
  assert.equal(many.ok, false);
  assert.equal(probe.provider.acquiredSpecs.length, 0);
  await session.send({ text: "hello", type: "prompt" });
  assert.equal((await collect(session)).at(-1)?.type, "run.settled");
});

test("tools backend: official Pi executes remote shell and cleanup precedes terminal event", async (t) => {
  const probe = await fixture(t, [
    fauxAssistantMessage(
      [fauxToolCall("bash", { command: "printf sandbox" })],
      { stopReason: "toolUse" }
    ),
    fauxAssistantMessage([fauxText("done")]),
  ]);
  const session = await probe.open();
  await session.send({ text: "execute", type: "prompt" });
  const events = await collect(session);
  assert.ok(
    events.some(
      (event) => event.type === "tool.started" && event.toolName === "bash"
    )
  );
  assert.ok(
    events.some((event) => event.type === "tool.completed" && !event.isError)
  );
  assert.equal(events.at(-1)?.type, "run.settled");
  assert.equal(
    await probe.provider.sandbox("test-sbx-1")?.handle.status(),
    "destroyed"
  );
  await session.close("done");
  await session.close("again");
});

test("tools backend: authorization failure is terminal failure, no provision or fake success", async (t) => {
  const probe = await fixture(
    t,
    [
      fauxAssistantMessage([fauxToolCall("bash", { command: "echo denied" })], {
        stopReason: "toolUse",
      }),
      fauxAssistantMessage([fauxText("fake success")]),
    ],
    () => Promise.reject(new Error("permission revoked"))
  );
  const session = await probe.open();
  await session.send({ text: "execute", type: "prompt" });
  const events = await collect(session);
  assert.equal(events.at(-1)?.type, "run.failed");
  assert.ok(
    events.some(
      (event) =>
        event.type === "run.failed" && /permission revoked/.test(event.error)
    )
  );
  assert.equal(probe.provider.acquiredSpecs.length, 0);
});

test("tools backend: timeout/unknown side effect fails the run despite model recovery", async (t) => {
  const probe = await fixture(t, [
    fauxAssistantMessage(
      [fauxToolCall("bash", { command: "sleep 5", timeout: 0.05 })],
      { stopReason: "toolUse" }
    ),
    fauxAssistantMessage([fauxText("fake success")]),
  ]);
  const session = await probe.open();
  await session.send({ text: "execute", type: "prompt" });
  const events = await collect(session);
  assert.equal(events.at(-1)?.type, "run.failed");
  assert.equal(
    await probe.provider.sandbox("test-sbx-1")?.handle.status(),
    "destroyed"
  );
});

test("tools backend: abort acknowledgement follows sandbox termination", {
  timeout: 10_000,
}, async (t) => {
  const probe = await fixture(t, [
    fauxAssistantMessage([fauxToolCall("bash", { command: "sleep 5" })], {
      stopReason: "toolUse",
    }),
    fauxAssistantMessage([fauxText("unused")]),
  ]);
  let started!: () => void;
  const acquired = new Promise<void>((resolve) => {
    started = resolve;
  });
  const original = probe.provider.acquire.bind(probe.provider);
  probe.provider.acquire = async (request) => {
    const handle = await original(request);
    started();
    return handle;
  };
  const session = await probe.open();
  const events = collect(session);
  await session.send({ text: "execute", type: "prompt" });
  await acquired;
  assert.equal((await session.send({ type: "abort" })).ok, true);
  assert.equal(
    await probe.provider.sandbox("test-sbx-1")?.handle.status(),
    "destroyed"
  );
  assert.equal(
    (await events).some(
      (event) => event.type === "run.settled" && event.reason === "completed"
    ),
    false
  );
});

test("tools backend: platform tool collisions and unapproved tools fail before session creation", async (t) => {
  const probe = await fixture(t, []);
  const tool = {
    description: "untrusted",
    execute: () =>
      Promise.resolve({
        content: [{ text: "bad", type: "text" as const }],
        details: undefined,
      }),
    label: "bad",
    name: "bash",
    parameters: Type.Object({}),
  };
  await assert.rejects(
    probe.backend.open({ ...probe.spec, tools: [tool] }),
    /unapproved-tool/
  );
  await assert.rejects(
    probe.backend.open({ ...probe.spec, workspaceDir: null }),
    /workspace-required/
  );
  assert.equal(probe.provider.acquiredSpecs.length, 0);
});

test("tools backend: delivery archives before artifact.created and tool.completed", async (t) => {
  let archived = false;
  const probe = await fixture(
    t,
    [
      fauxAssistantMessage(
        [
          fauxToolCall("write", {
            content: "office report",
            path: "report.txt",
          }),
        ],
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage(
        [fauxToolCall("deliver_file", { path: "report.txt" })],
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage([fauxText("delivered")]),
    ],
    undefined,
    (_spec, input) => {
      assert.equal(Buffer.from(input.content).toString(), "office report");
      assert.match(input.sha256, /^[a-f0-9]{64}$/);
      archived = true;
      return Promise.resolve({
        contentType: input.contentType,
        filename: input.filename,
        url: "/api/files/private-test",
      });
    }
  );
  const session = await probe.open();
  await session.send({ text: "create report", type: "prompt" });
  const events = await collect(session);
  const created = events.findIndex(
    (event) => event.type === "artifact.created"
  );
  const finished = events.findIndex(
    (event) =>
      event.type === "tool.completed" && event.toolName === "deliver_file"
  );
  assert.equal(archived, true);
  assert.ok(created >= 0 && finished > created);
  assert.equal(events.at(-1)?.type, "run.settled");
});

test("tools backend: public URL or archive failure cannot announce an artifact or successful run", async (t) => {
  const probe = await fixture(
    t,
    [
      fauxAssistantMessage(
        [fauxToolCall("write", { content: "report", path: "report.txt" })],
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage(
        [fauxToolCall("deliver_file", { path: "report.txt" })],
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage([fauxText("fake delivered")]),
    ],
    undefined,
    (_spec, input) =>
      Promise.resolve({
        contentType: input.contentType,
        filename: input.filename,
        url: "https://public.blob.example/report",
      })
  );
  const session = await probe.open();
  await session.send({ text: "create report", type: "prompt" });
  const events = await collect(session);
  assert.equal(
    events.some((event) => event.type === "artifact.created"),
    false
  );
  assert.equal(events.at(-1)?.type, "run.failed");
});

test("tools backend: unverified OpenSandbox provider cannot be enabled", () => {
  const probe = makeLazySandboxFixture();
  assert.throws(
    () =>
      new SandboxToolsBackend({
        authorizeTool: () => Promise.resolve(),
        provider: { ...probe.provider, name: "opensandbox" },
        sandboxSpec: () => Promise.resolve(probe.spec),
      }),
    /opensandbox-not-verified/
  );
});

test("tools backend: cleanup failure is observable and cannot emit settled", async (t) => {
  const probe = await fixture(t, [
    fauxAssistantMessage([fauxToolCall("bash", { command: "echo ok" })], {
      stopReason: "toolUse",
    }),
    fauxAssistantMessage([fauxText("done")]),
  ]);
  probe.provider.release = () => Promise.reject(new Error("kill unavailable"));
  const session = await probe.open();
  await session.send({ text: "execute", type: "prompt" });
  const events = await collect(session);
  assert.equal(events.at(-1)?.type, "run.failed");
  await assert.rejects(session.close("done"), /kill unavailable/);
  await assert.rejects(session.close("again"), /kill unavailable/);
  await probe.provider.sandbox("test-sbx-1")?.handle.destroy("kill");
});
