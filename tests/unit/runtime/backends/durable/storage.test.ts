import "../../../../support/runtime-env";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai";
import { createRegistry, Harness } from "@earendil-works/pi-durable";
import {
  type DurableStorageBinding,
  openOwnedDurableStorage,
} from "../../../../../lib/runtime/backends/durable/storage";

export const binding: DurableStorageBinding = {
  chatId: "00000000-0000-0000-0000-000000000002",
  inputHash: "a".repeat(64),
  runId: "00000000-0000-0000-0000-000000000003",
  userId: "00000000-0000-0000-0000-000000000001",
};
async function fixture(t: TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), "piwork-durable-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  return root;
}

test("Durable storage: official SQLite persists root/transcript across reopen", async (t) => {
  const root = await fixture(t);
  const owned = await openOwnedDurableStorage(root, binding);
  const harness = await Harness.open(
    owned.storage,
    { models: createModels(), registry: createRegistry() } as never,
    BACKGROUND_CONTEXT
  );
  const conversation = await harness.root(BACKGROUND_CONTEXT);
  await conversation.submit(
    {
      entry: { data: { value: "persisted" }, kind: "app.note" },
      requestId: "note",
      type: "write",
    },
    BACKGROUND_CONTEXT
  );
  await harness.close(BACKGROUND_CONTEXT);
  await owned.close();
  const reopened = await openOwnedDurableStorage(root, binding);
  const next = await Harness.open(
    reopened.storage,
    { models: createModels(), registry: createRegistry() } as never,
    BACKGROUND_CONTEXT
  );
  try {
    const recovered = await next.root(BACKGROUND_CONTEXT);
    assert.equal(recovered.id, conversation.id);
    const duplicate = await recovered.submit(
      {
        entry: { data: { value: "persisted" }, kind: "app.note" },
        requestId: "note",
        type: "write",
      },
      BACKGROUND_CONTEXT
    );
    assert.equal((await duplicate.status(BACKGROUND_CONTEXT)).status, "done");
    assert.equal(
      (await recovered.context(BACKGROUND_CONTEXT)).entries.filter(
        (entry) => entry.kind === "app.note"
      ).length,
      1
    );
  } finally {
    await next.close(BACKGROUND_CONTEXT);
    await reopened.close();
  }
});

test("Durable storage: second owner cannot open and ownership is released only on close", async (t) => {
  const root = await fixture(t);
  const first = await openOwnedDurableStorage(root, binding);
  await assert.rejects(
    openOwnedDurableStorage(root, binding),
    /storage-owned-or-needs-review/
  );
  const closing = first.close();
  assert.equal(first.close(), closing);
  await closing;
  const second = await openOwnedDurableStorage(root, binding);
  await second.close();
});

test("Durable storage: changed owner/input binding cannot reopen existing data", async (t) => {
  const root = await fixture(t);
  const first = await openOwnedDurableStorage(root, binding);
  await first.close();
  await assert.rejects(
    openOwnedDurableStorage(root, { ...binding, userId: crypto.randomUUID() }),
    /binding-mismatch/
  );
  await assert.rejects(
    openOwnedDurableStorage(root, { ...binding, inputHash: "b".repeat(64) }),
    /binding-mismatch/
  );
  const restored = await openOwnedDurableStorage(root, binding);
  await restored.close();
  assert.equal(
    JSON.parse(
      await readFile(path.join(root, binding.runId, "binding.json"), "utf8")
    ).userId,
    binding.userId
  );
});

test("Durable storage: previous Pi version binding cannot silently reopen", async (t) => {
  const root = await fixture(t);
  const first = await openOwnedDurableStorage(root, binding);
  await first.close();
  const manifestPath = path.join(root, binding.runId, "binding.json");
  const current = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(current);
  assert.equal(manifest.durableVersion, "1.1.0");
  assert.equal(manifest.piVersion, "1.1.0");
  await writeFile(
    manifestPath,
    JSON.stringify({ ...manifest, durableVersion: "1.0.3" })
  );
  await assert.rejects(
    openOwnedDurableStorage(root, binding),
    /binding-mismatch/
  );
  await writeFile(
    manifestPath,
    JSON.stringify({ ...manifest, piVersion: "1.0.3" })
  );
  await assert.rejects(
    openOwnedDurableStorage(root, binding),
    /binding-mismatch/
  );
  await writeFile(manifestPath, current);
  const reopened = await openOwnedDurableStorage(root, binding);
  await reopened.close();
});

test("Durable storage: invalid paths and symlinked SQLite files fail closed", async (t) => {
  const root = await fixture(t);
  await assert.rejects(
    openOwnedDurableStorage("relative", binding),
    /invalid-storage-binding/
  );
  await assert.rejects(
    openOwnedDurableStorage(root, { ...binding, runId: "../escape" }),
    /invalid-storage-binding/
  );
  const first = await openOwnedDurableStorage(root, binding);
  await first.close();
  const database = path.join(root, binding.runId, "session.sqlite");
  await rm(database);
  await symlink(path.join(root, "foreign.sqlite"), database);
  await assert.rejects(
    openOwnedDurableStorage(root, binding),
    /insecure-storage-file/
  );
});
