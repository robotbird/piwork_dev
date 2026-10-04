import "../../../../support/runtime-env";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  fauxAssistantMessage,
  fauxText,
  fauxToolCall,
} from "@earendil-works/pi-ai";
import { getPiModel, getTestFauxHandle } from "../../../../../lib/ai/pi";
import { createPrivateFileStore } from "../../../../../lib/ai/private-file-store";
import { SandboxToolsBackend } from "../../../../../lib/runtime/backends/sandbox-tools/backend";
import { createSandboxTools } from "../../../../../lib/runtime/backends/sandbox-tools/tools";
import type {
  RuntimeEvent,
  RuntimeSpec,
} from "../../../../../lib/runtime/protocol";
import { DockerSandboxProvider } from "../../../../../lib/runtime/sandbox/docker/provider";
import { LazySandbox } from "../../../../../lib/runtime/sandbox/lazy";
import { makeLazySandboxFixture } from "../../../../support/sandbox/lazy-provider";

const provider = new DockerSandboxProvider();
const enabled = process.env.PIWORK_SANDBOX_DOCKER_TESTS !== "0";
const ready =
  enabled &&
  (process.env.PIWORK_SANDBOX_DOCKER_TESTS === "1" ||
    (await provider.healthy()));
const suite = ready ? test : test.skip;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fixture(t: TestContext) {
  const base = path.join(process.cwd(), ".pi/test-sandboxes");
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(path.join(base, "tools-contract-"));
  const spec = {
    ...makeLazySandboxFixture().spec,
    image: "node:22-alpine",
    workspaceVolume: { source: directory },
  };
  const lazy = new LazySandbox(provider, spec);
  const bundle = createSandboxTools({
    authorize: () => Promise.resolve(),
    lazy,
    runId: directory,
  });
  t.after(async () => {
    await bundle.close();
    await rm(directory, { force: true, recursive: true });
  });
  const tool = (name: string) => {
    const found = bundle.tools.find((candidate) => candidate.name === name);
    assert.ok(found);
    return found;
  };
  return { bundle, directory, lazy, tool };
}
suite(
  "Docker backend: official Pi → isolated shell → private storage/archive → artifact event",
  async (t) => {
    const base = path.join(process.cwd(), ".pi/test-sandboxes");
    await mkdir(base, { recursive: true });
    const directory = await mkdtemp(path.join(base, "backend-office-"));
    const storage = await mkdtemp(path.join(base, "private-storage-"));
    t.after(async () => {
      await rm(directory, { force: true, recursive: true });
      await rm(storage, { force: true, recursive: true });
    });
    const model = await getPiModel("deepseek/deepseek-flash");
    const faux = getTestFauxHandle();
    assert.ok(faux);
    faux.setResponses([
      fauxAssistantMessage(
        [
          fauxToolCall("bash", {
            command: "printf 'dept,amount\\nA,10\\nB,20\\n' > report.csv",
          }),
        ],
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage(
        [fauxToolCall("deliver_file", { path: "report.csv" })],
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage([fauxText("report delivered")]),
    ]);
    const store = createPrivateFileStore(storage);
    const archived = new Set<string>();
    const backend = new SandboxToolsBackend({
      authorizeTool: () => Promise.resolve(),
      provider,
      publishArtifact: async (request, input) => {
        const file = await store({
          content: input.content,
          contentType: input.contentType,
          filename: input.filename,
          operationKey: `${request.chatId}/${input.runId}/${input.toolCallId}`,
        });
        archived.add(file.url); // Injected archive seam; not a real DB/HTTP proof.
        return {
          contentType: file.contentType,
          downloadUrl: file.downloadUrl,
          filename: file.name,
          url: file.url,
        };
      },
      sandboxSpec: (request, runId) =>
        Promise.resolve({
          ...makeLazySandboxFixture().spec,
          chatId: request.chatId,
          image: "node:22-alpine",
          runId,
          workspaceVolume: { source: directory },
        }),
    });
    const spec: RuntimeSpec = {
      appendSystemPrompt: [],
      chatId: "docker-office",
      historyMessages: [],
      model,
      runId: crypto.randomUUID(),
      systemPrompt: "office contract",
      tools: [],
      workspaceDir: directory,
    };
    const session = await backend.open(spec);
    t.after(() => session.close("test"));
    await session.send({ text: "generate CSV", type: "prompt" });
    const events: RuntimeEvent[] = [];
    for await (const event of session.events()) {
      if (event.type === "artifact.created") {
        assert.equal(archived.has(event.file.url), true);
        assert.match(event.file.url, /^\/api\/files\/private-/);
        const id = event.file.url.slice("/api/files/".length);
        assert.equal(
          await readFile(path.join(storage, id), "utf8"),
          "dept,amount\nA,10\nB,20\n"
        );
      }
      events.push(event);
      if (event.type === "run.settled" || event.type === "run.failed") {
        break;
      }
    }
    assert.equal(events.at(-1)?.type, "run.settled");
    assert.equal(
      events.filter((event) => event.type === "artifact.created").length,
      1
    );
  }
);

const text = (result: { content: Array<{ type: string; text?: string }> }) =>
  result.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");

suite(
  "Docker tools: anchored atomic write/read/edit and version conflict",
  async (t) => {
    const { lazy, tool } = await fixture(t);
    await tool("write").execute("w1", {
      content: "alpha\nbeta",
      path: "nested/report",
    });
    await tool("edit").execute("e1", {
      edits: [{ newText: "A", oldText: "alpha" }],
      path: "nested/report",
    });
    assert.equal(
      text(await tool("read").execute("r1", { path: "nested/report" })),
      "A\nbeta"
    );
    const fs = (await lazy.ensure()).filesystem;
    assert.ok(fs);
    const before = await fs.read("nested/report", 1024);
    await tool("write").execute("w2", {
      content: "changed",
      path: "nested/report",
    });
    await assert.rejects(
      fs.writeAtomic({
        content: Buffer.from("stale"),
        expectedSha256: before.sha256,
        maxBytes: 1024,
        path: "nested/report",
      }),
      /CONFLICT/
    );
    await assert.rejects(fs.read("nested/report", 2), /LIMIT/);
    assert.equal(
      text(await tool("read").execute("r2", { path: "nested/report" })),
      "changed"
    );
  }
);

suite(
  "Docker tools: symlink/special-file/hardlink reads and writes fail closed",
  async (t) => {
    const { tool } = await fixture(t);
    await tool("bash").execute("b1", {
      command:
        "ln -s /etc escape; ln -s /etc/passwd symlink; mkfifo fifo; echo data > a; ln a b",
    });
    for (const file of ["escape/passwd", "symlink", "fifo", "a", "b"]) {
      // biome-ignore lint/performance/noAwaitInLoops: assert each safety rejection separately on a shared sandbox.
      await assert.rejects(tool("read").execute(`r-${file}`, { path: file }));
    }
    await assert.rejects(
      tool("write").execute("w1", { content: "bad", path: "escape/passwd" })
    );
  }
);

suite(
  "Docker tools: stdout/stderr stream and host credentials are not forwarded",
  async (t) => {
    const { lazy, tool } = await fixture(t);
    const handle = await lazy.ensure();
    const original = handle.startProcess.bind(handle);
    let dispatches = 0;
    handle.startProcess = (command) => {
      dispatches += 1;
      assert.equal(command.env, undefined);
      assert.equal(command.cwd, "/workspace");
      return original(command);
    };
    const result = await tool("bash").execute("b1", {
      command:
        "printf 'out\\n'; printf 'err\\n' >&2; printf '%s' \"\u0024{OPENAI_API_KEY-unset}\"",
    });
    assert.match(text(result), /out/);
    assert.match(text(result), /err/);
    assert.match(text(result), /unset/);
    assert.equal(dispatches, 1);
  }
);

suite(
  "Docker tools: timeout kills descendants before reporting stopped",
  async (t) => {
    const { bundle, directory, lazy, tool } = await fixture(t);
    const handle = await lazy.ensure();
    await assert.rejects(
      tool("bash").execute("b1", {
        command: "(sleep 1.2; echo escaped > late-file) & wait",
        timeout: 0.5,
      }),
      /outcome unknown/
    );
    assert.equal(await handle.status(), "destroyed");
    assert.equal(bundle.observation("b1")?.processesStopped, true);
    await sleep(1500);
    await assert.rejects(readFile(path.join(directory, "late-file")), {
      code: "ENOENT",
    });
  }
);

suite(
  "Docker tools: started command with lost transport is never replayed",
  async (t) => {
    const { bundle, directory, lazy, tool } = await fixture(t);
    const handle = await lazy.ensure();
    const original = handle.startProcess.bind(handle);
    let dispatches = 0;
    handle.startProcess = async (command) => {
      dispatches += 1;
      const channel = await original(command);
      return {
        ...channel,
        async *readCombined() {
          for (let attempt = 0; attempt < 100; attempt += 1) {
            try {
              // biome-ignore lint/performance/noAwaitInLoops: poll for the real side effect before injecting a transport fault.
              await readFile(path.join(directory, "started"));
              break;
            } catch {
              await sleep(20);
            }
          }
          // A real side effect is observable before losing the result channel.
          assert.equal(
            await readFile(path.join(directory, "started"), "utf8"),
            "started\n"
          );
          yield new Uint8Array();
          throw new Error("simulated lost transport acknowledgement");
        },
      };
    };
    await assert.rejects(
      tool("bash").execute("b1", {
        command: "echo started > started; sleep 10",
      }),
      /outcome unknown/
    );
    assert.equal(bundle.observation("b1")?.phase, "outcome_unknown");
    assert.equal(bundle.observation("b1")?.processesStopped, true);
    assert.equal(dispatches, 1);
    await assert.rejects(
      tool("bash").execute("b1", { command: "echo replayed >> started" }),
      /closed/
    );
    assert.equal(
      await readFile(path.join(directory, "started"), "utf8"),
      "started\n"
    );
  }
);
