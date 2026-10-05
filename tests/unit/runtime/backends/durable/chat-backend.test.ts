import "../../../../support/runtime-env";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  type FauxResponseStep,
  fauxAssistantMessage,
  fauxToolCall,
} from "@earendil-works/pi-ai";
import { getPiModel, getTestFauxHandle } from "../../../../../lib/ai/pi";
import {
  DurableChatBackend,
  type DurableChatServices,
} from "../../../../../lib/runtime/backends/durable/chat-backend";
import {
  hashDurableChatInput,
  hashDurablePrompt,
  sha256,
} from "../../../../../lib/runtime/backends/durable/chat-input";
import type { DurableChatConfig } from "../../../../../lib/runtime/backends/durable/chat-policy";
import type {
  RuntimeEvent,
  RuntimeSession,
  RuntimeSpec,
} from "../../../../../lib/runtime/protocol";
import { TestSandboxProvider } from "../../../../support/sandbox/test-sandbox-provider";

function call(name: string, args: Parameters<typeof fauxToolCall>[1]) {
  return fauxAssistantMessage([fauxToolCall(name, args)], {
    stopReason: "toolUse",
  });
}
async function fixture(t: TestContext, responses: FauxResponseStep[]) {
  const root = await mkdtemp(path.join(tmpdir(), "durable-chat-"));
  const userId = crypto.randomUUID();
  const provider = new TestSandboxProvider();
  const prompt = {
    expandPromptTemplates: false,
    text: "build a private artifact",
    type: "prompt" as const,
  };
  const config: DurableChatConfig = {
    filesRoot: path.join(root, "private"),
    image: "test",
    provider: "docker",
    storageRoot: path.join(root, "sqlite"),
    users: new Set([userId]),
  };
  await mkdir(config.filesRoot, { mode: 0o700 });
  const spec: RuntimeSpec = {
    appendSystemPrompt: [],
    chatId: crypto.randomUUID(),
    durableChat: {
      attachments: [],
      catalogModelId: "deepseek/deepseek-flash",
      promptHash: hashDurablePrompt(prompt),
      userId,
    },
    historyMessages: [],
    lane: "durable_sandbox",
    model: await getPiModel("deepseek/deepseek-flash"),
    runId: crypto.randomUUID(),
    systemPrompt: "four tools only",
    tools: [],
    workspaceDir: "ephemeral",
  };
  const archived: string[] = [];
  const state = {
    allowed: true,
    archived,
    config: config as DurableChatConfig | null,
    content: Buffer.from("source"),
    modelEnabled: true,
  };
  const fileId = crypto.randomUUID();
  const item = {
    contentType: "text/plain",
    id: fileId,
    kind: "file",
    name: "source.txt",
    url: "/api/files/source.txt",
  };
  const services: DurableChatServices = {
    archive: (_owner, file) => {
      archived.push(file.url);
      return Promise.resolve();
    },
    authorizeRun: (owner, chatId, runId) =>
      Promise.resolve(
        state.allowed &&
          owner === userId &&
          chatId === spec.chatId &&
          runId === spec.runId
      ),
    config: () => state.config,
    files: {
      byId: (owner, id) =>
        Promise.resolve(owner === userId && id === fileId ? item : undefined),
      byUrl: () => Promise.resolve(item),
      read: () => Promise.resolve(state.content),
    },
    modelEnabled: (id) =>
      Promise.resolve(
        state.modelEnabled && id === spec.durableChat?.catalogModelId
      ),
  };
  getTestFauxHandle()?.setResponses(responses);
  let session: RuntimeSession | undefined;
  t.after(async () => {
    await session?.close("test").catch(() => undefined);
    await Promise.all(
      provider.acquiredSpecs.map(async (_allocation, index) => {
        const sandbox = provider.sandbox(`test-sbx-${index + 1}`);
        await sandbox?.handle.destroy("kill");
        if (sandbox) {
          await rm(sandbox.workspaceDir, { force: true, recursive: true });
        }
      })
    );
    await rm(root, { force: true, recursive: true });
  });
  const backend = new DurableChatBackend(provider, services);
  const grant = spec.durableChat;
  assert.ok(grant);
  return {
    backend,
    config,
    fileId,
    grant,
    open: async () => {
      session = await backend.open(spec);
      return session;
    },
    prompt,
    provider,
    services,
    spec,
    state,
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

test("chat lane: immutable input binds model/history/prompt/config, not just user text", async (t) => {
  const f = await fixture(t, []);
  const original = hashDurableChatInput(f.spec, f.config);
  assert.notEqual(
    hashDurableChatInput({ ...f.spec, systemPrompt: "changed" }, f.config),
    original
  );
  assert.notEqual(
    hashDurableChatInput(f.spec, { ...f.config, image: "changed" }),
    original
  );
  assert.notEqual(
    hashDurableChatInput(
      {
        ...f.spec,
        durableChat: { ...f.grant, promptHash: "b".repeat(64) },
      },
      f.config
    ),
    original
  );
});

test("chat lane: bounded hydration precedes execution and privately archives before artifact event", {
  timeout: 15_000,
}, async (t) => {
  const f = await fixture(t, [
    call("bash", { command: "cat inputs/1-source.txt > report.txt" }),
    call("deliver_file", { path: "report.txt" }),
    fauxAssistantMessage("done"),
  ]);
  f.grant.attachments.push({
    libraryItemId: f.fileId,
    path: "inputs/1-source.txt",
    sha256: sha256(f.state.content),
    size: f.state.content.length,
  });
  const session = await f.open();
  assert.equal((await session.send(f.prompt)).ok, true);
  const events = await collect(session);
  assert.equal(events.at(-1)?.type, "run.settled");
  const artifact = events.find((event) => event.type === "artifact.created");
  assert.ok(artifact?.type === "artifact.created");
  assert.deepEqual(f.state.archived, [artifact.file.url]);
  assert.ok(artifact.file.url.startsWith("/api/files/"));
  assert.equal(
    await readFile(
      path.join(
        f.config.filesRoot,
        artifact.file.url.replace("/api/files/", "")
      ),
      "utf8"
    ),
    "source"
  );
  assert.equal(
    await f.provider.sandbox("test-sbx-1")?.handle.status(),
    "destroyed"
  );
  assert.equal(f.provider.acquiredSpecs[0].workspaceVolume.source, "ephemeral");
  assert.deepEqual(f.provider.acquiredSpecs[0].egress, { mode: "deny-all" });
});

test("chat lane: changed or revoked attachment aborts, kills container, never runs shell", {
  timeout: 15_000,
}, async (t) => {
  const f = await fixture(t, [
    call("bash", { command: "touch should-not-exist" }),
    fauxAssistantMessage("fake success"),
  ]);
  f.grant.attachments.push({
    libraryItemId: f.fileId,
    path: "inputs/1-source.txt",
    sha256: sha256("source"),
    size: 6,
  });
  const session = await f.open();
  f.state.content = Buffer.from("CHANGED");
  await session.send(f.prompt);
  const events = await collect(session);
  assert.equal(events.at(-1)?.type, "run.failed");
  const sandbox = f.provider.sandbox("test-sbx-1");
  assert.ok(sandbox);
  assert.equal(await sandbox.handle.status(), "destroyed");
  assert.ok(
    !(await readdir(sandbox.workspaceDir)).includes("should-not-exist")
  );
  assert.equal(getTestFauxHandle()?.getPendingResponseCount(), 1);
});

test("chat lane: unpublished archive failure cannot produce an artifact or false success", {
  timeout: 15_000,
}, async (t) => {
  const f = await fixture(t, [
    call("write", { content: "secret", path: "report.txt" }),
    call("deliver_file", { path: "report.txt" }),
    fauxAssistantMessage("fake success"),
  ]);
  f.services.archive = () => Promise.reject(new Error("archive offline"));
  const session = await f.open();
  await session.send(f.prompt);
  const events = await collect(session);
  assert.equal(events.at(-1)?.type, "run.failed");
  assert.ok(!events.some((event) => event.type === "artifact.created"));
  assert.equal(
    await f.provider.sandbox("test-sbx-1")?.handle.status(),
    "destroyed"
  );
  // Private orphan is not authorized for download; no public Blob fallback.
  assert.equal((await readdir(f.config.filesRoot)).length, 2);
});

test("chat lane: revoked grant during archive suppresses artifact and final success without public fallback", {
  timeout: 15_000,
}, async (t) => {
  const f = await fixture(t, [
    call("write", { content: "secret", path: "report.txt" }),
    call("deliver_file", { path: "report.txt" }),
    fauxAssistantMessage("fake success"),
  ]);
  f.services.archive = (_owner, file) => {
    f.state.archived.push(file.url);
    f.state.allowed = false;
    return Promise.resolve();
  };
  const session = await f.open();
  await session.send(f.prompt);
  const events = await collect(session);
  assert.equal(events.at(-1)?.type, "run.failed");
  assert.ok(!events.some((event) => event.type === "artifact.created"));
  assert.equal(f.state.archived.length, 1);
  assert.equal(getTestFauxHandle()?.getPendingResponseCount(), 1);
  assert.equal(
    await f.provider.sandbox("test-sbx-1")?.handle.status(),
    "destroyed"
  );
});

test("chat lane: unauthorized open creates no SQLite or sandbox, prompt substitution rejects", async (t) => {
  const f = await fixture(t, [fauxAssistantMessage("unused")]);
  f.state.allowed = false;
  await assert.rejects(f.open(), /grant-revoked/);
  f.state.allowed = true;
  const session = await f.open();
  assert.equal(
    (await session.send({ ...f.prompt, text: "substituted" })).ok,
    false
  );
  assert.equal(getTestFauxHandle()?.getPendingResponseCount(), 1);
  f.state.allowed = false;
  assert.equal((await session.send(f.prompt)).ok, false);
  assert.equal(f.provider.acquiredSpecs.length, 0);
});

test("chat lane: model revocation, config revocation and nonempty platform tools fail closed", async (t) => {
  const f = await fixture(t, []);
  f.state.modelEnabled = false;
  await assert.rejects(f.open(), /grant-revoked/);
  f.state.modelEnabled = true;
  f.spec.tools = [{ name: "create_scheduled_task" } as never];
  await assert.rejects(f.open(), /platform-tools-not-approved/);
  f.spec.tools = [];
  f.state.config = null;
  await assert.rejects(f.open(), /invalid-server-grant/);
  assert.equal(f.provider.acquiredSpecs.length, 0);
});

test("chat lane: cancellation aborts pending hydration, kills sandbox, never launches requested shell", {
  timeout: 15_000,
}, async (t) => {
  const f = await fixture(t, [
    call("bash", { command: "touch should-not-run" }),
    fauxAssistantMessage("unused"),
  ]);
  f.grant.attachments.push({
    libraryItemId: f.fileId,
    path: "inputs/1-source.txt",
    sha256: sha256("source"),
    size: 6,
  });
  let began!: () => void;
  const downloading = new Promise<void>((resolve) => {
    began = resolve;
  });
  f.services.files.read = (_url, _limit, signal) => {
    assert.ok(signal);
    began();
    return new Promise((_resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason);
      } else {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }
    });
  };
  const session = await f.open();
  await session.send(f.prompt);
  await downloading;
  assert.equal((await session.send({ type: "abort" })).ok, true);
  const events = await collect(session);
  assert.ok(
    events.at(-1)?.type === "run.failed" ||
      (events.at(-1)?.type === "run.settled" &&
        events.some(
          (event) => event.type === "run.settled" && event.reason === "aborted"
        ))
  );
  const sandbox = f.provider.sandbox("test-sbx-1");
  assert.ok(sandbox);
  assert.equal(await sandbox.handle.status(), "destroyed");
  assert.ok(!(await readdir(sandbox.workspaceDir)).includes("should-not-run"));
});

test("chat lane: revoked attachment ownership cannot become a host-path or URL read", {
  timeout: 15_000,
}, async (t) => {
  const f = await fixture(t, [
    call("read", { path: "inputs/1-source.txt" }),
    fauxAssistantMessage("unused"),
  ]);
  f.grant.attachments.push({
    libraryItemId: f.fileId,
    path: "inputs/1-source.txt",
    sha256: sha256("source"),
    size: 6,
  });
  const session = await f.open();
  f.services.files.byId = () => Promise.resolve(undefined);
  await session.send(f.prompt);
  assert.equal((await collect(session)).at(-1)?.type, "run.failed");
  assert.equal(
    await f.provider.sandbox("test-sbx-1")?.handle.status(),
    "destroyed"
  );
});

test("chat lane: failure to hydrate cannot silently ignore missing atomic filesystem", async (t) => {
  const f = await fixture(t, [
    call("read", { path: "inputs/1-source.txt" }),
    fauxAssistantMessage("fake success"),
  ]);
  const acquire = f.provider.acquire.bind(f.provider);
  f.provider.acquire = async (spec) => {
    const handle = await acquire(spec);
    Object.defineProperty(handle, "filesystem", { value: undefined });
    return handle;
  };
  const session = await f.open();
  await session.send(f.prompt);
  assert.equal((await collect(session)).at(-1)?.type, "run.failed");
  assert.equal(
    await f.provider.sandbox("test-sbx-1")?.handle.status(),
    "destroyed"
  );
});
