import "../../../../support/runtime-env";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createModels, fauxAssistantMessage } from "@earendil-works/pi-ai";
import { fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import { createRegistry, Harness } from "@earendil-works/pi-durable";
import { assertDurableRecoverySafe } from "../../../../../lib/runtime/backends/durable/recovery";
import { openOwnedDurableStorage } from "../../../../../lib/runtime/backends/durable/storage";

const binding = {
  chatId: "00000000-0000-0000-0000-000000000002",
  inputHash: "a".repeat(64),
  runId: "00000000-0000-0000-0000-000000000003",
  userId: "00000000-0000-0000-0000-000000000001",
};
async function crash(t: TestContext, mode: string) {
  const root = await mkdtemp(path.join(tmpdir(), "piwork-durable-crash-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  const child = fork(
    path.join(process.cwd(), "tests/support/durable/crash-child.ts"),
    [root, mode],
    {
      execArgv: ["--conditions=react-server", "--import", "tsx"],
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    }
  );
  let errors = "";
  child.stderr?.on("data", (chunk) => {
    errors += String(chunk);
  });
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
  });
  const ready = once(child, "message");
  const exit = once(child, "exit");
  await Promise.race([
    ready,
    exit.then(() => {
      throw new Error(`child exited before checkpoint: ${errors}`);
    }),
  ]);
  child.kill("SIGKILL");
  await exit;
  assert.equal(child.signalCode, "SIGKILL");
  return root;
}
async function reopened(root: string) {
  const owned = await openOwnedDurableStorage(root, binding);
  const models = createModels();
  const faux = fauxProvider();
  models.setProvider(faux.provider);
  const registry = createRegistry();
  const harness = await Harness.open(
    owned.storage,
    { models, registry },
    BACKGROUND_CONTEXT
  );
  return { faux, harness, owned };
}

// Removal is test-only, after SIGKILL receipt; production has no lock-steal API.
async function reconcileTestProcess(root: string) {
  await unlink(path.join(root, binding.runId, "owner.lock"));
}

test("Durable crash: dead owner remains blocked instead of silently stealing storage", {
  timeout: 20_000,
}, async (t) => {
  const root = await crash(t, "lock");
  await assert.rejects(
    openOwnedDurableStorage(root, binding),
    /storage-owned-or-needs-review/
  );
  await reconcileTestProcess(root);
  const owned = await openOwnedDurableStorage(root, binding);
  await owned.close();
});

test("Durable crash: model request resumes on official storage, requestId is not duplicated", {
  timeout: 20_000,
}, async (t) => {
  const root = await crash(t, "model");
  await reconcileTestProcess(root);
  const next = await reopened(root);
  try {
    await assertDurableRecoverySafe(next.harness);
    next.faux.setResponses([fauxAssistantMessage("recovered")]);
    const conversation = await next.harness.root(BACKGROUND_CONTEXT);
    const submission = await conversation.submit(
      { content: "request", requestId: "stable-request", type: "input" },
      BACKGROUND_CONTEXT
    );
    assert.equal((await submission.wait(BACKGROUND_CONTEXT)).status, "done");
    assert.equal(
      (
        await conversation.submit(
          { content: "request", requestId: "stable-request", type: "input" },
          BACKGROUND_CONTEXT
        )
      ).id,
      submission.id
    );
    assert.equal(
      (await conversation.context(BACKGROUND_CONTEXT)).entries.filter(
        (entry) => entry.kind === "pi.user"
      ).length,
      1
    );
  } finally {
    await next.harness.close(BACKGROUND_CONTEXT);
    await next.owned.close();
  }
});

test("Durable crash: unsafe effect intent blocks before scheduler/model resume", {
  timeout: 20_000,
}, async (t) => {
  const root = await crash(t, "tool");
  await reconcileTestProcess(root);
  const next = await reopened(root);
  try {
    await assert.rejects(
      assertDurableRecoverySafe(next.harness),
      /needs-review:interrupted-tool-intent/
    );
    assert.equal(await readFile(path.join(root, "effects"), "utf8"), "once\n");
    assert.equal(next.faux.state.callCount, 0);
    assert.equal(
      (await next.harness.inspect(BACKGROUND_CONTEXT)).scheduling,
      "paused"
    );
  } finally {
    await next.harness.close(BACKGROUND_CONTEXT);
    await next.owned.close();
  }
});

test("Durable recovery: previously materialized interrupted result also blocks", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "piwork-durable-result-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  const next = await reopened(root);
  try {
    const conversation = await next.harness.root(BACKGROUND_CONTEXT);
    await conversation.submit(
      {
        entry: {
          data: {
            diagnostics: [
              {
                code: "interrupted",
                message: "unknown effect",
                severity: "error",
              },
            ],
          },
          kind: "pi.tool-result",
        },
        type: "write",
      },
      BACKGROUND_CONTEXT
    );
    await assert.rejects(
      assertDurableRecoverySafe(next.harness),
      /needs-review:uncertain-tool-result/
    );
  } finally {
    await next.harness.close(BACKGROUND_CONTEXT);
    await next.owned.close();
  }
});
