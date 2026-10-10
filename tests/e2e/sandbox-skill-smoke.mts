// Single real container + official RPC; deterministic faux model, no live LLM.
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { type Api, fauxProvider, type Model } from "@earendil-works/pi-ai";
import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent";
import { buildSkillsSystemPrompt } from "../../lib/ai/skills";
import { SandboxRpcBackend } from "../../lib/runtime/backends/sandbox-rpc/backend";
import type { RuntimeEvent, RuntimeSession } from "../../lib/runtime/protocol";
import type { SandboxHandle, SandboxProvider } from "../../lib/runtime/sandbox";
import { buildSandboxProvider } from "../../lib/runtime/sandbox/configuration";

if (process.env.PIWORK_SANDBOX_SKILL_TEST !== "1") {
  console.log(
    "Skipped: set PIWORK_SANDBOX_SKILL_TEST=1, provider/image/CLI and PIWORK_SKILL_TEST_EXTENSION."
  );
  process.exit(0);
}
const kind = process.env.PIWORK_SANDBOX_PROVIDER;
assert(kind === "docker" || kind === "opensandbox");
const image = process.env.PIWORK_SANDBOX_IMAGE;
const cli = process.env.PIWORK_SANDBOX_CLI_PATH;
const extension = process.env.PIWORK_SKILL_TEST_EXTENSION;
assert(image && cli && extension);
const fixtureRoot = path.resolve(
  process.env.PIWORK_SKILL_TEST_ROOT ?? "tests/fixtures/skills"
);
const staging = await mkdtemp(path.join(tmpdir(), "piwork-skill-probe-"));
const root = path.join(staging, "skills");
await cp(fixtureRoot, root, { recursive: true });
const { skills } = loadSkillsFromDir({ dir: root, source: "project" });
assert.equal(skills.length, 1);
const base = buildSandboxProvider(kind);
const extensions: string[] = [];
let handle: SandboxHandle | undefined;
let session: RuntimeSession | undefined;
const events: RuntimeEvent[] = [];
const expected = "SKILL_SCRIPT_OK:沙箱资源:引用说明";
const order: string[] = [];
const provider: SandboxProvider = {
  acquire: async (spec) => {
    handle = await base.acquire({
      ...spec,
      workspaceVolume: { source: "ephemeral" },
    });
    try {
      assert(handle.filesystem);
      await handle.filesystem.writeAtomic({
        content: await readFile(extension),
        expectedSha256: null,
        maxBytes: 1024 * 1024,
        path: "piwork/skill-probe.mjs",
      });
      extensions.push(
        path.posix.join(handle.workspaceRoot, "piwork/skill-probe.mjs")
      );
      return handle;
    } catch (error) {
      await base.release(handle, "kill");
      throw error;
    }
  },
  attach: (id) => base.attach(id),
  name: base.name,
  release: (resource, policy) => base.release(resource, policy),
};
try {
  const model = fauxProvider({
    models: [{ id: "probe", name: "Skill probe" }],
    provider: "piwork-skill-probe",
  }).models[0] as Model<Api>;
  const backend = new SandboxRpcBackend({
    archiveFile: () => {
      order.push("archive");
      return Promise.resolve();
    },
    extensions,
    image,
    provider,
    remoteCliPath: cli,
    resourcePolicy: async () => ({ cpuCores: 0.5, memoryMB: 768 }),
    skillsRoot: root,
    store: (input) => {
      assert.equal(Buffer.from(input.buffer).toString(), expected);
      order.push("store");
      return Promise.resolve({
        contentType: input.contentType,
        name: input.filename,
        pathname: "probe/skill-result.txt",
        url: "https://probe.invalid/skill-result.txt",
      });
    },
    ttlSeconds: 600,
  });
  session = await backend.open({
    appendSystemPrompt: [buildSkillsSystemPrompt(skills)],
    chatId: crypto.randomUUID(),
    historyMessages: [],
    model,
    skills,
    systemPrompt: "Execute the selected Skill inside the sandbox.",
    tools: [],
    workspaceDir: staging,
  });
  assert(handle);
  console.log("Real sandbox:", handle.id, "provider:", kind);
  const drain = (async () => {
    for await (const event of session.events()) {
      events.push(event);
    }
  })();
  await session.send({
    expandPromptTemplates: false,
    text: "/skill:sandbox-script execute and deliver the report",
    type: "prompt",
  });
  const deadline = Date.now() + 60_000;
  while (
    !events.some(
      (event) => event.type === "run.settled" || event.type === "run.failed"
    )
  ) {
    if (Date.now() > deadline) {
      throw new Error("Skill probe timed out");
    }
    // biome-ignore lint/performance/noAwaitInLoops: bounded sequential terminal polling
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert(!events.some((event) => event.type === "run.failed"));
  assert(
    events.some(
      (event) =>
        event.type === "tool.completed" &&
        event.toolName === "bash" &&
        !event.isError
    )
  );
  assert.equal(
    Buffer.from(await handle.readFile("skill-result.txt")).toString(),
    expected
  );
  const expanded = Buffer.from(
    await handle.readFile("piwork/skill-expanded.txt")
  ).toString();
  assert(
    expanded.includes(
      `<skill name="sandbox-script" location="${handle.workspaceRoot}/piwork/skills/`
    )
  );
  assert(!expanded.includes(root));
  await session.close("probe-done");
  await drain;
  assert.deepEqual(order, ["store", "archive"]);
  assert(events.some((event) => event.type === "artifact.created"));
  assert.equal(await base.control?.inspect(handle.id), null);
  console.log(
    "PASS: official Skill expansion, actual script/assets/references, output, store/archive callbacks, artifact event and confirmed deletion"
  );
} finally {
  await session?.close("probe-cleanup");
  if (handle && (await handle.status()) !== "destroyed") {
    await base.release(handle, "kill");
  }
  await rm(staging, { force: true, recursive: true });
}
