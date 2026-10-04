import "../../../support/runtime-env";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  link,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { makeLazySandboxFixture } from "../../../support/sandbox/lazy-provider";
import { TestSandboxProvider } from "../../../support/sandbox/test-sandbox-provider";

async function fixture(t: TestContext) {
  const provider = new TestSandboxProvider();
  const handle = await provider.acquire(makeLazySandboxFixture().spec);
  t.after(async () => {
    await provider.release(handle, "kill");
    await rm(handle.workspaceRoot, { force: true, recursive: true });
  });
  assert.ok(handle.filesystem);
  return { fs: handle.filesystem, handle };
}
const bytes = (value: string) => Buffer.from(value);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

test("filesystem: atomic nested create and bounded/hash-verified read", async (t) => {
  const { fs } = await fixture(t);
  await fs.writeAtomic({
    content: bytes("hello\nworld"),
    expectedSha256: null,
    maxBytes: 1024,
    path: "nested/report.txt",
  });
  assert.deepEqual(await fs.stat("nested/report.txt"), { size: 11 });
  const file = await fs.read("nested/report.txt", 1024);
  assert.equal(Buffer.from(file.content).toString(), "hello\nworld");
  assert.equal(file.sha256, sha("hello\nworld"));
  assert.equal(await fs.stat("missing/path.txt"), null);
});

test("filesystem: empty files and binary stdin work without EOF signalling", async (t) => {
  const { fs } = await fixture(t);
  await fs.writeAtomic({
    content: bytes(""),
    expectedSha256: null,
    maxBytes: 1024,
    path: "empty",
  });
  assert.equal((await fs.read("empty", 1024)).content.length, 0);
  const content = Buffer.alloc(100_000, 0xff);
  await fs.writeAtomic({
    content,
    expectedSha256: null,
    maxBytes: content.length,
    path: "binary",
  });
  assert.deepEqual(
    Buffer.from((await fs.read("binary", content.length)).content),
    content
  );
});

test("filesystem: new-file precondition never overwrites competing creation", async (t) => {
  const { fs, handle } = await fixture(t);
  await handle.writeFile("report", bytes("original"));
  await assert.rejects(
    fs.writeAtomic({
      content: bytes("wrong"),
      expectedSha256: null,
      maxBytes: 1024,
      path: "report",
    }),
    /CONFLICT/
  );
  assert.equal(
    Buffer.from((await fs.read("report", 1024)).content).toString(),
    "original"
  );
});

test("filesystem: hash precondition catches a changed or removed edit target", async (t) => {
  const { fs, handle } = await fixture(t);
  await handle.writeFile("report", bytes("original"));
  await handle.writeFile("report", bytes("changed"));
  await assert.rejects(
    fs.writeAtomic({
      content: bytes("replacement"),
      expectedSha256: sha("original"),
      maxBytes: 1024,
      path: "report",
    }),
    /CONFLICT/
  );
  assert.equal(
    Buffer.from((await fs.read("report", 1024)).content).toString(),
    "changed"
  );
  await assert.rejects(
    fs.writeAtomic({
      content: bytes("replacement"),
      expectedSha256: sha("original"),
      maxBytes: 1024,
      path: "gone",
    }),
    /CONFLICT/
  );
  await fs.writeAtomic({
    content: bytes("valid"),
    expectedSha256: sha("changed"),
    maxBytes: 1024,
    path: "report",
  });
  assert.equal(
    Buffer.from((await fs.read("report", 1024)).content).toString(),
    "valid"
  );
});

test("filesystem: reject transfer limit before growing host memory, retain original on failed write", async (t) => {
  const { fs, handle } = await fixture(t);
  await handle.writeFile("report", bytes("12345"));
  await assert.rejects(fs.read("report", 4), /LIMIT/);
  await assert.rejects(
    fs.writeAtomic({
      content: bytes("12345"),
      expectedSha256: sha("12345"),
      maxBytes: 4,
      path: "report",
    }),
    /limit/
  );
  assert.equal(
    Buffer.from((await fs.read("report", 10)).content).toString(),
    "12345"
  );
  assert.notEqual(await handle.status(), "destroyed");
});

test("filesystem: reject symlink files/directories, hardlinks and lexical escapes", async (t) => {
  const { fs, handle } = await fixture(t);
  const outside = await mkdtemp(path.join(tmpdir(), "piwork-fs-outside-"));
  t.after(() => rm(outside, { force: true, recursive: true }));
  await writeFile(path.join(outside, "secret"), "private");
  await symlink(outside, path.join(handle.workspaceRoot, "linked-dir"));
  await symlink(
    path.join(outside, "secret"),
    path.join(handle.workspaceRoot, "linked-file")
  );
  await assert.rejects(fs.read("linked-file", 100));
  await assert.rejects(fs.read("linked-dir/secret", 100));
  await assert.rejects(
    fs.writeAtomic({
      content: bytes("oops"),
      expectedSha256: null,
      maxBytes: 100,
      path: "linked-dir/secret",
    })
  );
  await assert.rejects(fs.read("../secret", 100), /PATH_ESCAPE/);
  await assert.rejects(fs.read("/etc/passwd", 100), /PATH_ESCAPE/);
  await assert.rejects(fs.read(".", 100), /PATH_ESCAPE/);
  await handle.writeFile("a", bytes("a"));
  await link(
    path.join(handle.workspaceRoot, "a"),
    path.join(handle.workspaceRoot, "b")
  );
  await assert.rejects(fs.read("a", 100), /UNSAFE_FILE/);
  assert.equal(await readFile(path.join(outside, "secret"), "utf8"), "private");
});

test("filesystem: pre-aborted request does not dispatch a helper", async (t) => {
  const { fs, handle } = await fixture(t);
  let calls = 0;
  handle.startProcess = () => {
    calls += 1;
    return Promise.reject(new Error("unexpected"));
  };
  const controller = new AbortController();
  controller.abort(new Error("cancelled"));
  await assert.rejects(fs.read("report", 100, controller.signal), /cancelled/);
  assert.equal(calls, 0);
});

test("filesystem: ambiguous transport failure kills sandbox and never retries", async (t) => {
  const { fs, handle } = await fixture(t);
  let calls = 0;
  handle.startProcess = () => {
    calls += 1;
    return Promise.reject(new Error("lost acknowledgement"));
  };
  await assert.rejects(
    fs.writeAtomic({
      content: bytes("a"),
      expectedSha256: null,
      maxBytes: 100,
      path: "report",
    }),
    /outcome unknown/
  );
  assert.equal(calls, 1);
  assert.equal(await handle.status(), "destroyed");
});
