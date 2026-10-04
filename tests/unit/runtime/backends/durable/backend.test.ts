import "../../../../support/runtime-env";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  fauxAssistantMessage,
  fauxToolCall,
  Type,
} from "@earendil-works/pi-ai";
import { getPiModel, getTestFauxHandle } from "../../../../../lib/ai/pi";
import { DurableBackend } from "../../../../../lib/runtime/backends/durable/backend";
import { openOwnedDurableStorage } from "../../../../../lib/runtime/backends/durable/storage";
import type { RuntimeSpec } from "../../../../../lib/runtime/protocol";

async function spec(): Promise<RuntimeSpec> {
  return {
    appendSystemPrompt: [],
    chatId: "00000000-0000-0000-0000-000000000002",
    historyMessages: [],
    model: await getPiModel("deepseek/deepseek-flash"),
    runId: "00000000-0000-0000-0000-000000000003",
    systemPrompt: "durable test",
    tools: [],
    workspaceDir: null,
  };
}

test("Durable backend: production cannot silently select MemoryStorage", async () => {
  const request = await spec();
  const environment = process.env as Record<string, string | undefined>;
  const previous = environment.NODE_ENV;
  environment.NODE_ENV = "production";
  try {
    await assert.rejects(
      new DurableBackend().open(request),
      /memory-storage-forbidden-in-production/
    );
  } finally {
    if (previous === undefined) {
      // biome-ignore lint/performance/noDelete: process.env assignment of undefined creates the string "undefined"
      delete environment.NODE_ENV;
    } else {
      environment.NODE_ENV = previous;
    }
  }
});

test("Durable backend: persistent storage requires current authorization", async () => {
  const backend = new DurableBackend({
    storageFactory: () => {
      throw new Error("must not open");
    },
  });
  await assert.rejects(backend.open(await spec()), /missing-authorization/);
});

test("Durable backend: denied authorization cannot open storage or start model", async () => {
  const backend = new DurableBackend({
    authorize: () => Promise.reject(new Error("revoked")),
    storageFactory: () => {
      throw new Error("must not open");
    },
  });
  await assert.rejects(backend.open(await spec()), /revoked/);
});

test("Durable backend: persistent lane refuses unintegrated workspace execution", async () => {
  const backend = new DurableBackend({
    authorize: () => Promise.resolve(),
    storageFactory: () => {
      throw new Error("must not open");
    },
  });
  await assert.rejects(
    backend.open({ ...(await spec()), workspaceDir: "/workspace" }),
    /sandbox-execution-not-integrated/
  );
});

test("Durable backend: revoked execute grant cannot be masked by a later model success", {
  timeout: 10_000,
}, async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "piwork-durable-revoked-"));
  const request = await spec();
  let authorizations = 0;
  let effects = 0;
  request.tools = [
    {
      description: "test policy",
      execute: () => {
        effects += 1;
        return Promise.resolve({
          content: [{ text: "allowed", type: "text" }],
          details: {},
        });
      },
      label: "policy",
      name: "policy",
      parameters: Type.Object({}),
    },
  ];
  const backend = new DurableBackend({
    authorize: () => {
      authorizations += 1;
      return authorizations === 1
        ? Promise.resolve()
        : Promise.reject(new Error("grant revoked"));
    },
    storageFactory: () =>
      openOwnedDurableStorage(root, {
        chatId: request.chatId,
        inputHash: "a".repeat(64),
        runId: request.runId ?? "",
        userId: "00000000-0000-0000-0000-000000000001",
      }),
  });
  const faux = getTestFauxHandle();
  assert.ok(faux);
  faux.setResponses([
    fauxAssistantMessage([fauxToolCall("policy", {})], {
      stopReason: "toolUse",
    }),
    fauxAssistantMessage("false success"),
  ]);
  const session = await backend.open(request);
  t.after(async () => {
    try {
      await session.close("test");
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
  await session.send({ text: "policy", type: "prompt" });
  let outcome = "";
  for await (const event of session.events()) {
    if (event.type === "run.settled" || event.type === "run.failed") {
      outcome = event.type;
      break;
    }
  }
  assert.equal(outcome, "run.failed");
  assert.equal(effects, 0);
  assert.equal(faux.getPendingResponseCount(), 1);
});

test("Durable backend: official loop writes SQLite and closes its ownership marker", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "piwork-durable-backend-"));
  const request = await spec();
  const backend = new DurableBackend({
    authorize: () => Promise.resolve(),
    storageFactory: () =>
      openOwnedDurableStorage(root, {
        chatId: request.chatId,
        inputHash: "a".repeat(64),
        runId: request.runId ?? "",
        userId: "00000000-0000-0000-0000-000000000001",
      }),
  });
  getTestFauxHandle()?.setResponses([fauxAssistantMessage("persisted answer")]);
  const session = await backend.open(request);
  t.after(async () => {
    try {
      await session.close("test");
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
  await session.send({ text: "hello", type: "prompt" });
  let outcome = "";
  for await (const event of session.events()) {
    if (event.type === "run.settled" || event.type === "run.failed") {
      outcome = event.type;
      break;
    }
  }
  assert.equal(outcome, "run.settled");
  await session.close("test");
  const files = await readdir(path.join(root, request.runId ?? ""));
  assert.equal(files.includes("session.sqlite"), true);
  assert.equal(files.includes("owner.lock"), false);
});
