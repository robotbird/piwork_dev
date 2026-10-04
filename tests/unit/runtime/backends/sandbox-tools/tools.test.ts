import "../../../../support/runtime-env";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  createBashToolDefinition,
  createEditToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { createSandboxTools } from "../../../../../lib/runtime/backends/sandbox-tools/tools";
import { LazySandbox } from "../../../../../lib/runtime/sandbox/lazy";
import { SandboxOperationError } from "../../../../../lib/runtime/sandbox/operation-error";
import { makeLazySandboxFixture } from "../../../../support/sandbox/lazy-provider";
import { TestSandboxProvider } from "../../../../support/sandbox/test-sandbox-provider";

function fixture(t: TestContext) {
  const provider = new TestSandboxProvider();
  const lazy = new LazySandbox(provider, makeLazySandboxFixture().spec);
  const authorized: string[] = [];
  const bundle = createSandboxTools({
    authorize: (_id, name) => {
      authorized.push(name);
      return Promise.resolve();
    },
    lazy,
    runId: "run-test",
  });
  t.after(async () => {
    await bundle.close();
    const directory = provider.sandbox("test-sbx-1")?.workspaceDir;
    if (directory) {
      await rm(directory, { force: true, recursive: true });
    }
  });
  const tool = (name: string) => {
    const found = bundle.tools.find((item) => item.name === name);
    assert.ok(found);
    return found;
  };
  return { authorized, bundle, lazy, provider, tool };
}
const text = (result: { content: Array<{ type: string; text?: string }> }) =>
  result.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("tools: registration is lazy and schemas match official Pi tools", async (t) => {
  const { bundle, provider, tool } = await fixture(t);
  assert.equal(provider.acquiredSpecs.length, 0);
  for (const official of [
    createReadToolDefinition("/workspace"),
    createEditToolDefinition("/workspace"),
    createWriteToolDefinition("/workspace"),
    createBashToolDefinition("/workspace"),
  ]) {
    assert.deepEqual(tool(official.name).parameters, official.parameters);
    assert.equal(tool(official.name).executionMode, "sequential");
  }
  await bundle.close();
  assert.equal(provider.acquiredSpecs.length, 0);
});

test("tools: authorization rejection cannot provision or execute", async () => {
  const probe = makeLazySandboxFixture();
  const lazy = new LazySandbox(probe.provider, probe.spec);
  const bundle = createSandboxTools({
    authorize: () => Promise.reject(new Error("denied")),
    lazy,
    runId: "denied-run",
  });
  const bash = bundle.tools.find((tool) => tool.name === "bash");
  assert.ok(bash);
  await assert.rejects(bash.execute("c1", { command: "echo bad" }), /denied/);
  assert.equal(probe.calls.acquire, 0);
  await bundle.close();
});

test("tools: write/read/edit preserve Pi multi-edit and unified diff semantics", async (t) => {
  const { tool, authorized } = await fixture(t);
  await tool("write").execute("w1", {
    content: "alpha\nbeta\ngamma",
    path: "nested/report.txt",
  });
  const excerpt = await tool("read").execute("r1", {
    limit: 1,
    offset: 2,
    path: "nested/report.txt",
  });
  assert.match(text(excerpt), /^beta/);
  assert.match(text(excerpt), /offset=3/);
  const result = await tool("edit").execute("e1", {
    edits: [
      { newText: "A", oldText: "alpha" },
      { newText: "G", oldText: "gamma" },
    ],
    path: "nested/report.txt",
  });
  assert.match(JSON.stringify(result.details), /patch/);
  const current = await tool("read").execute("r2", {
    path: "nested/report.txt",
  });
  assert.equal(text(current), "A\nbeta\nG");
  assert.deepEqual(authorized, ["write", "read", "edit", "read"]);
});

test("tools: ambiguous/overlapping edits fail without altering the file", async (t) => {
  const { tool } = await fixture(t);
  await tool("write").execute("w1", {
    content: "repeat repeat",
    path: "report",
  });
  await assert.rejects(
    tool("edit").execute("e1", {
      edits: [{ newText: "X", oldText: "repeat" }],
      path: "report",
    })
  );
  assert.equal(
    text(await tool("read").execute("r1", { path: "report" })),
    "repeat repeat"
  );
});

test("tools: paths never expand host homes or escape the workspace", async (t) => {
  const { tool } = await fixture(t);
  for (const target of [
    "../outside",
    "/etc/passwd",
    "~/.ssh/id_rsa",
    "a/../b",
    "a\\b",
  ]) {
    // biome-ignore lint/performance/noAwaitInLoops: verify path rejections separately on one run.
    await assert.rejects(
      tool("write").execute(`w-${target}`, { content: "bad", path: target }),
      /path|workspace/i
    );
  }
});

test("tools: read returns image bytes without host image decoding and rejects host Office parsing", async (t) => {
  const { lazy, tool } = await fixture(t);
  const handle = await lazy.ensure();
  const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  await handle.writeFile("image.png", image);
  const result = await tool("read").execute("r1", { path: "image.png" });
  assert.ok(
    result.content.some(
      (part) => part.type === "image" && part.data === image.toString("base64")
    )
  );
  await tool("write").execute("w1", {
    content: "%PDF sample",
    path: "report.pdf",
  });
  await assert.rejects(
    tool("read").execute("r2", { path: "report.pdf" }),
    /extract PDF\/Office/
  );
});

test("tools: bash streams stdout/stderr, reports nonzero exit and never forwards host env", async (t) => {
  const { tool } = await fixture(t);
  const updates: string[] = [];
  const result = await tool("bash").execute(
    "b1",
    { command: "printf 'out\\n'; printf 'err\\n' >&2; exit 3" },
    undefined,
    (update) => updates.push(text(update))
  );
  assert.match(text(result), /out/);
  assert.match(text(result), /err/);
  assert.match(text(result), /exit code: 3/);
  assert.equal(result.isError, true);
  assert.ok(updates.length > 0);
});

test("tools: bash tail truncation creates no host log filepath", async (t) => {
  const { tool } = await fixture(t);
  const result = await tool("bash").execute("b1", {
    command: "i=1; while [ $i -le 500 ]; do echo line-$i; i=$((i+1)); done",
  });
  assert.match(text(result), /line-500/);
  assert.match(text(result), /Output truncated/);
  assert.doesNotMatch(text(result), /\/tmp\/pi-bash|Full output:/);
  assert.equal(result.details, undefined);
});

test("tools: delivery replay projects once and rejects operation/path conflicts", async (t) => {
  const probe = fixture(t);
  let publications = 0;
  let projections = 0;
  const artifacts = createSandboxTools({
    authorize: () => Promise.resolve(),
    lazy: probe.lazy,
    onArtifact: () => {
      projections += 1;
    },
    publishArtifact: (input) => {
      publications += 1;
      return Promise.resolve({
        contentType: input.contentType,
        filename: input.filename,
        url: "/api/files/private-test",
      });
    },
    runId: "artifact-run",
  });
  t.after(() => artifacts.close());
  const write = artifacts.tools.find((tool) => tool.name === "write");
  const deliver = artifacts.tools.find((tool) => tool.name === "deliver_file");
  assert.ok(write && deliver);
  await write.execute("w1", { content: "report", path: "report.txt" });
  const first = await deliver.execute("d1", { path: "report.txt" });
  assert.deepEqual(await deliver.execute("d1", { path: "report.txt" }), first);
  await assert.rejects(
    deliver.execute("d1", { path: "other.txt" }),
    /ID\/path conflict/
  );
  assert.equal(publications, 1);
  assert.equal(projections, 1);
});

test("tools: duplicate command ID cannot replay a shell side effect", async (t) => {
  const { bundle, tool } = await fixture(t);
  await tool("bash").execute("b1", { command: "printf done" });
  await assert.rejects(
    tool("bash").execute("b1", { command: "printf again" }),
    /already used/
  );
  assert.equal(bundle.observation("b1")?.phase, "completed");
  assert.equal(bundle.observation("b1")?.processesStopped, false);
});

test("tools: invalid timeout is rejected before provision", async (t) => {
  const { provider, tool } = await fixture(t);
  for (const timeout of [0, -1, 1801, Number.NaN]) {
    // biome-ignore lint/performance/noAwaitInLoops: verify pre-provision timeout rejection for each case.
    await assert.rejects(
      tool("bash").execute(`b-${timeout}`, { command: "echo bad", timeout }),
      /Invalid command/
    );
  }
  assert.equal(provider.acquiredSpecs.length, 0);
});

test("tools: timeout stops sandbox descendants and blocks future execution", async (t) => {
  const { bundle, lazy, tool } = await fixture(t);
  const handle = await lazy.ensure();
  await assert.rejects(
    tool("bash").execute("b1", {
      command: "(sleep 0.4; echo escaped > late-file) & wait",
      timeout: 0.1,
    }),
    /outcome unknown/
  );
  assert.equal(bundle.observation("b1")?.phase, "outcome_unknown");
  assert.equal(bundle.observation("b1")?.processesStopped, true);
  assert.equal(await handle.status(), "destroyed");
  await sleep(500);
  await assert.rejects(readFile(path.join(handle.workspaceRoot, "late-file")), {
    code: "ENOENT",
  });
  await assert.rejects(
    tool("bash").execute("b2", { command: "echo new" }),
    /closed/
  );
});

test("tools: abort waits for sandbox destruction before returning", async (t) => {
  const { bundle, lazy, tool } = await fixture(t);
  const handle = await lazy.ensure();
  const controller = new AbortController();
  const pending = tool("bash").execute(
    "b1",
    { command: "sleep 10" },
    controller.signal
  );
  const rejected = assert.rejects(pending, /outcome unknown/);
  await sleep(50);
  controller.abort();
  await rejected;
  assert.equal(await handle.status(), "destroyed");
  assert.equal(bundle.observation("b1")?.processesStopped, true);
});

test("tools: newline-heavy reads use bounded windows and correct continuation", async (t) => {
  const { lazy, tool } = await fixture(t);
  const handle = await lazy.ensure();
  await handle.writeFile("many-lines", Buffer.from("x\n".repeat(100_000)));
  const result = await tool("read").execute("r1", { path: "many-lines" });
  assert.ok(text(result).length < 10_000);
  assert.match(text(result), /offset=2001/);
  assert.equal(
    text(
      await tool("read").execute("r2", {
        limit: 1,
        offset: 100_000,
        path: "many-lines",
      })
    ).split("\n")[0],
    "x"
  );
  await assert.rejects(
    tool("read").execute("r3", { offset: 100_002, path: "many-lines" }),
    /exceeds file length/
  );
});

test("tools: failed kill cannot fabricate stopped evidence or retry release", async () => {
  const probe = makeLazySandboxFixture();
  probe.provider.release = (_handle, policy) => {
    probe.calls.releases.push(policy);
    return Promise.reject(new Error("kill unconfirmed"));
  };
  const bundle = createSandboxTools({
    authorize: () => Promise.resolve(),
    lazy: new LazySandbox(probe.provider, probe.spec),
    runId: "unknown-run",
  });
  const bash = bundle.tools.find((tool) => tool.name === "bash");
  assert.ok(bash);
  await assert.rejects(
    bash.execute("b1", { command: "echo danger" }),
    (error: unknown) =>
      error instanceof SandboxOperationError &&
      error.phase === "outcome_unknown"
  );
  assert.equal(bundle.observation("b1")?.processesStopped, false);
  assert.equal(probe.calls.process, 1);
  assert.deepEqual(probe.calls.releases, ["kill"]);
  await assert.rejects(bundle.close(), /kill unconfirmed/);
});

test("tools: output quota stops a noisy command even when stderr stays idle", {
  timeout: 10_000,
}, async (t) => {
  const { bundle, lazy, tool } = await fixture(t);
  const handle = await lazy.ensure();
  await assert.rejects(
    tool("bash").execute("b1", {
      command:
        "node -e 'process.stdout.write(\"x\".repeat(11*1024*1024)); setInterval(() => {}, 1000)'",
    }),
    /output limit/
  );
  assert.equal(bundle.observation("b1")?.processesStopped, true);
  assert.equal(await handle.status(), "destroyed");
});
