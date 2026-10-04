import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { createPrivateFileStore } from "../../../lib/ai/private-file-store";

async function fixture(t: TestContext) {
  const directory = await mkdtemp(
    path.join(tmpdir(), "piwork-private-artifact-")
  );
  t.after(() => rm(directory, { force: true, recursive: true }));
  return { directory, store: createPrivateFileStore(directory) };
}
const input = {
  content: Buffer.from("report"),
  contentType: "text/plain",
  filename: "报告.txt",
  operationKey: "user/run/tool-call",
};

test("private store: protected platform URL, immutable bytes and local metadata", async (t) => {
  const { directory, store } = await fixture(t);
  const file = await store(input);
  assert.match(file.url, /^\/api\/files\/private-[a-f0-9]{64}$/);
  assert.equal(file.downloadUrl, `${file.url}?download=1`);
  assert.equal(
    await readFile(path.join(directory, file.pathname), "utf8"),
    "report"
  );
  assert.deepEqual(
    JSON.parse(
      await readFile(path.join(directory, `${file.pathname}.json`), "utf8")
    ),
    { contentType: "text/plain", name: "报告.txt" }
  );
});

test("private store: replay and concurrent identical operation create one byte object", async (t) => {
  const { directory, store } = await fixture(t);
  const [first, second] = await Promise.all([store(input), store(input)]);
  assert.deepEqual(first, second);
  assert.deepEqual(await store(input), first);
  assert.equal((await readdir(directory)).length, 2);
});

test("private store: partial metadata publication can be repaired, conflicting replay never overwrites", async (t) => {
  const { directory, store } = await fixture(t);
  const file = await store(input);
  await unlink(path.join(directory, `${file.pathname}.json`));
  assert.deepEqual(await store(input), file);
  await assert.rejects(
    store({ ...input, content: Buffer.from("changed") }),
    /operation-content-conflict/
  );
  await assert.rejects(
    store({ ...input, filename: "other.txt" }),
    /operation-content-conflict/
  );
  assert.equal(
    await readFile(path.join(directory, file.pathname), "utf8"),
    "report"
  );
  assert.equal((await readdir(directory)).length, 2);
});

test("private store: actor namespace isolates identical content and invalid header metadata is rejected", async (t) => {
  const { store } = await fixture(t);
  const first = await store(input);
  const second = await store({
    ...input,
    operationKey: "other-user/run/tool-call",
  });
  assert.notEqual(first.url, second.url);
  await assert.rejects(
    store({ ...input, contentType: "text/plain\r\nX-Injected: true" }),
    /invalid-input/
  );
  await assert.rejects(
    store({ ...input, filename: "bad\0name" }),
    /invalid-input/
  );
});
