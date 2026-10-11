// biome-ignore-all lint/performance/noAwaitInLoops: sequential fault probes require ordered writes and cleanup
import "../../../../support/runtime-env";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createReadTool } from "@earendil-works/pi-coding-agent";
import { getPiModel } from "@/lib/ai/pi";
import { projectSourceReferences } from "@/lib/projects/document-inputs";
import { InProcessBackend } from "@/lib/runtime/backends/in-process/backend";
import { LocalRpcBackend } from "@/lib/runtime/backends/local-rpc/backend";
import { resolveDefaultCliPath } from "@/lib/runtime/backends/local-rpc/spawn";
import { SandboxRpcBackend } from "@/lib/runtime/backends/sandbox-rpc/backend";
import { installProjectDocuments } from "@/lib/runtime/backends/sandbox-rpc/project-sources";
import type {
  ProjectSourcesGrant,
  RuntimeEvent,
  RuntimeSpec,
} from "@/lib/runtime/protocol";
import type { SandboxHandle } from "@/lib/runtime/sandbox";
import { TestSandboxProvider } from "../../../../support/sandbox/test-sandbox-provider";

const source = {
  content: `${"a".repeat(160_000)}\n场景42：末尾证据`,
  id: "00000000-0000-0000-0000-000000000042",
  name: "../恶意文件名.txt",
  type: "txt",
};

async function spec(): Promise<
  RuntimeSpec & {
    projectSources: ProjectSourcesGrant;
    runId: string;
    workspaceDir: string;
  }
> {
  return {
    appendSystemPrompt: [],
    chatId: crypto.randomUUID(),
    historyMessages: [],
    model: await getPiModel("deepseek/deepseek-flash"),
    projectSources: {
      projectId: crypto.randomUUID(),
      sources: projectSourceReferences([source]),
      userId: crypto.randomUUID(),
    },
    runId: crypto.randomUUID(),
    systemPrompt: "Document test",
    tools: [],
    workspaceDir: "host-workspace-must-not-leak",
  };
}

function acquire(provider: TestSandboxProvider, input: RuntimeSpec) {
  assert.ok(input.runId);
  return provider.acquire({
    chatId: input.chatId,
    egress: { mode: "deny-all" },
    image: "test",
    metadata: {},
    resource: { cpuCores: 1, memoryMB: 768 },
    runId: input.runId,
    ttlSeconds: 60,
    workspaceVolume: { source: "ephemeral" },
  });
}

test("atomic segments reconstruct full text; official read continues after line truncation", async () => {
  const provider = new TestSandboxProvider();
  const input = await spec();
  const handle = await acquire(provider, input);
  const content = `${"数据\n".repeat(4000)}末尾证明`;
  const document = { ...source, content };
  input.projectSources.sources = projectSourceReferences([document]);
  let checks = 0;
  try {
    const prompt = await installProjectDocuments(handle, input, () => {
      checks += 1;
      return Promise.resolve([document]);
    });
    assert.equal(checks, 2);
    assert.ok(!prompt.includes(input.workspaceDir));
    const dirs = await readdir(
      path.join(handle.workspaceRoot, "piwork/document-inputs")
    );
    const manifest = JSON.parse(
      await readFile(
        path.join(
          handle.workspaceRoot,
          "piwork/document-inputs",
          dirs[0],
          "manifest.json"
        ),
        "utf8"
      )
    );
    const index = JSON.parse(
      await readFile(manifest.sources[0].indexPath, "utf8")
    );
    const buffers = await Promise.all(
      index.segments.map((segment: { path: string }) => readFile(segment.path))
    );
    assert.equal(Buffer.concat(buffers).toString("utf8"), content);
    assert.equal(index.segments[0].byteStart, 0);
    assert.equal(
      index.segments.at(-1).byteEndExclusive,
      Buffer.byteLength(content)
    );
    const tool = createReadTool(handle.workspaceRoot);
    const first = await tool.execute("read1", { path: index.segments[0].path });
    assert.match(JSON.stringify(first.content), /offset=2001/);
    const last = await tool.execute("read2", {
      limit: 1,
      offset: 4001,
      path: index.segments[0].path,
    });
    assert.match(JSON.stringify(last.content), /末尾证明/);
  } finally {
    await provider.release(handle, "kill");
    await rm(handle.workspaceRoot, { force: true, recursive: true });
  }
});

test("changed/revoked sources and cancellation never publish a usable manifest", async () => {
  for (const failure of [
    "hash",
    "revoked",
    "cancel",
    "write",
    "before-commit",
  ] as const) {
    const provider = new TestSandboxProvider();
    const input = await spec();
    const handle = await acquire(provider, input);
    let calls = 0;
    const controller = new AbortController();
    const load = () => {
      calls += 1;
      if (
        failure === "revoked" ||
        (failure === "before-commit" && calls === 2)
      ) {
        return Promise.reject(new Error("revoked"));
      }
      if (failure === "cancel") {
        controller.abort();
      }
      return Promise.resolve([
        { ...source, content: failure === "hash" ? "changed" : source.content },
      ]);
    };
    assert.ok(handle.filesystem);
    const wrapped: SandboxHandle =
      failure === "write"
        ? ({
            ...handle,
            filesystem: {
              ...handle.filesystem,
              writeAtomic: () => Promise.reject(new Error("disk full")),
            },
            workspaceRoot: handle.workspaceRoot,
          } as SandboxHandle)
        : handle;
    try {
      await assert.rejects(
        installProjectDocuments(wrapped, input, load, controller.signal)
      );
      const root = path.join(handle.workspaceRoot, "piwork/document-inputs");
      const dirs = await readdir(root).catch(() => []);
      for (const dir of dirs) {
        await assert.rejects(readFile(path.join(root, dir, "manifest.json")));
      }
    } finally {
      await provider.release(handle, "kill");
      await rm(handle.workspaceRoot, { force: true, recursive: true });
    }
  }
});

test("missing loader fails before acquire; hydration failure kills acquired sandbox and revokes token", async () => {
  const provider = new TestSandboxProvider();
  const input = await spec();
  const missing = new SandboxRpcBackend({
    provider,
    remoteCliPath: resolveDefaultCliPath(),
  });
  await assert.rejects(missing.open(input), /loader-required/);
  assert.equal(provider.acquiredSpecs.length, 0);
  let revoked = false;
  const failing = new SandboxRpcBackend({
    inference: {
      mintRunToken: () => "test-token",
      proxyUrl: "http://localhost:3210",
      revokeRunTokens: () => {
        revoked = true;
      },
    },
    projectDocuments: () => Promise.reject(new Error("authorization revoked")),
    provider,
    remoteCliPath: resolveDefaultCliPath(),
  });
  await assert.rejects(failing.open(input), /authorization revoked/);
  assert.equal(
    await provider.sandbox("test-sbx-1")?.handle.status(),
    "destroyed"
  );
  assert.equal(revoked, true);
  const sandbox = provider.sandbox("test-sbx-1");
  assert.ok(sandbox);
  await rm(sandbox.workspaceDir, {
    force: true,
    recursive: true,
  });
});

test("real official RpcClient/Pi tools read stored tail beyond both old cutoffs", {
  timeout: 60_000,
}, async () => {
  const provider = new TestSandboxProvider();
  const host = await mkdtemp(path.join(tmpdir(), "piwork-document-test-"));
  const backend = new SandboxRpcBackend({
    extensions: [
      fileURLToPath(
        new URL(
          "../../../../support/project-document-faux-extension.ts",
          import.meta.url
        )
      ),
    ],
    projectDocuments: () => Promise.resolve([source]),
    provider,
    remoteCliPath: resolveDefaultCliPath(),
  });
  const input = await spec();
  input.workspaceDir = host;
  const session = await backend.open(input);
  try {
    const events: RuntimeEvent[] = [];
    const collecting = (async () => {
      for await (const event of session.events()) {
        events.push(event);
        if (event.type === "run.settled" || event.type === "run.failed") {
          break;
        }
      }
    })();
    const ack = await session.send({
      expandPromptTemplates: false,
      text: "读取末尾场景",
      type: "prompt",
    });
    assert.equal(ack.ok, true, JSON.stringify(ack));
    await collecting;
    assert.equal(
      events.filter(
        (event) => event.type === "tool.completed" && !event.isError
      ).length,
      3,
      JSON.stringify(events)
    );
    assert.ok(
      events.some(
        (event) =>
          event.type === "message.delta" && event.delta?.includes("末尾证据")
      ) || JSON.stringify(events).includes("末尾证据")
    );
    assert.equal(events.at(-1)?.type, "run.settled");
  } finally {
    await session.close("test-done");
    await rm(host, { force: true, recursive: true });
    const sandbox = provider.sandbox("test-sbx-1");
    assert.ok(sandbox);
    await rm(sandbox.workspaceDir, {
      force: true,
      recursive: true,
    });
  }
});

test("project grant cannot silently execute with host or local RPC tools", async () => {
  const input = await spec();
  await assert.rejects(
    new InProcessBackend().open(input),
    /sandbox-rpc-required/
  );
  await assert.rejects(
    new LocalRpcBackend().open(input),
    /sandbox-rpc-required/
  );
});

test("missing atomic filesystem fails closed; failed destruction is explicitly reported", async () => {
  const provider = new TestSandboxProvider();
  const originalAcquire = provider.acquire.bind(provider);
  provider.acquire = async (request) => {
    const handle = await originalAcquire(request);
    Object.defineProperty(handle, "filesystem", { value: undefined });
    return handle;
  };
  const backend = new SandboxRpcBackend({
    projectDocuments: () => Promise.resolve([source]),
    provider,
    remoteCliPath: resolveDefaultCliPath(),
  });
  await assert.rejects(backend.open(await spec()), /filesystem-required/);
  const first = provider.sandbox("test-sbx-1");
  assert.ok(first);
  assert.equal(await first.handle.status(), "destroyed");
  await rm(first.workspaceDir, { force: true, recursive: true });
  provider.release = () => Promise.reject(new Error("destroy failed"));
  await assert.rejects(
    backend.open(await spec()),
    (error: unknown) =>
      error instanceof AggregateError &&
      error.message === "runtime:project-documents:cleanup-failed" &&
      error.errors.some((failure) => failure.message === "destroy failed")
  );
  const second = provider.sandbox("test-sbx-2");
  assert.ok(second);
  await second.handle.destroy("kill");
  await rm(second.workspaceDir, { force: true, recursive: true });
});
