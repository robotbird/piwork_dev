import "../../../support/runtime-env";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { FauxResponseStep } from "@earendil-works/pi-ai";
import {
  fauxAssistantMessage,
  fauxText,
  fauxToolCall,
} from "@earendil-works/pi-ai";
import type { StoredFile } from "@/lib/ai/file-store";
import { getPiModel } from "@/lib/ai/pi";
import { resolveDefaultCliPath } from "@/lib/runtime/backends/local-rpc/spawn";
import { SandboxRpcBackend } from "@/lib/runtime/backends/sandbox-rpc/backend";
import type {
  RuntimeEvent,
  RuntimeSession,
  RuntimeSpec,
} from "@/lib/runtime/protocol";
import { SandboxUnavailableError } from "@/lib/runtime/sandbox";
import { TestSandboxProvider } from "../../../support/sandbox/test-sandbox-provider";

/**
 * SandboxRpcBackend 专测（spec §6 Phase 2 / §7.3）：补契约套件
 * （backends.test.ts 的 SandboxRpc harness）不覆盖的底座专属行为——
 * fail-closed、remoteCliPath 必填、会话 seeding 落 workspace、close 后按
 * kill 策略释放。协议等价性由契约套件证明，此处不重复。
 */

const FAUX_EXTENSION_PATH = fileURLToPath(
  new URL("../../../support/faux-provider-extension.ts", import.meta.url)
);

const TEST_TIMEOUT_MS = 60_000;
const TEST_MODEL_ID = "deepseek/deepseek-flash";

let cachedModel: RuntimeSpec["model"] | undefined;

async function makeSpec(
  overrides: Partial<
    Pick<RuntimeSpec, "chatId" | "historyMessages" | "workspaceDir">
  > = {}
): Promise<RuntimeSpec> {
  cachedModel ??= await getPiModel(TEST_MODEL_ID);
  return {
    appendSystemPrompt: [],
    chatId: overrides.chatId ?? "00000000-0000-0000-0000-0000000000b1",
    historyMessages: overrides.historyMessages ?? [],
    model: cachedModel,
    systemPrompt: "piwork sandbox-rpc test",
    tools: [],
    workspaceDir: overrides.workspaceDir ?? null,
  };
}

/** faux 响应脚本落盘并给出 backend 侧 env（与 LocalRpc 契约 harness 同构） */
async function fauxScriptEnv(
  steps: FauxResponseStep[]
): Promise<{ env: Record<string, string> }> {
  const scriptDir = await mkdtemp(path.join(tmpdir(), "piwork-sbx-script-"));
  const scriptPath = path.join(scriptDir, "faux-script.json");
  await writeFile(scriptPath, JSON.stringify(steps));
  return { env: { PIWORK_FAUX_SCRIPT: scriptPath } };
}

async function collect(session: RuntimeSession): Promise<RuntimeEvent[]> {
  const events: RuntimeEvent[] = [];
  for await (const event of session.events()) {
    events.push(event);
    if (event.type === "run.settled" || event.type === "run.failed") {
      break;
    }
  }
  return events;
}

const NON_EMPTY_HISTORY: RuntimeSpec["historyMessages"] = [
  { content: "历史问题", role: "user", timestamp: Date.now() },
  {
    api: "openai-completions",
    content: [{ text: "历史回答", type: "text" }],
    model: "deepseek-flash",
    provider: "deepseek",
    role: "assistant",
    stopReason: "stop",
    timestamp: Date.now(),
    usage: {
      cacheRead: 0,
      cacheWrite: 0,
      cost: {
        cacheRead: 0,
        cacheWrite: 0,
        input: 0,
        output: 0,
        total: 0,
      },
      input: 0,
      output: 0,
      totalTokens: 0,
    },
  },
];

test("resource policy is sampled for each open and passed unchanged to acquire", async () => {
  const acquired: Array<{ cpuCores: number; memoryMB: number }> = [];
  let policy = { cpuCores: 1, memoryMB: 768 };
  const failure = new Error("acquire probe");
  const backend = new SandboxRpcBackend({
    provider: {
      acquire: (request) => {
        acquired.push(request.resource);
        return Promise.reject(failure);
      },
      attach: () => Promise.reject(failure),
      name: "test",
      release: () => Promise.resolve(),
    },
    remoteCliPath: resolveDefaultCliPath(),
    resourcePolicy: async () => policy,
  });
  await assert.rejects(
    backend.open(await makeSpec()),
    (error) => error === failure
  );
  policy = { cpuCores: 0.5, memoryMB: 1024 };
  await assert.rejects(
    backend.open(await makeSpec()),
    (error) => error === failure
  );
  assert.deepEqual(acquired, [{ cpuCores: 1, memoryMB: 768 }, policy]);
});

test("resource policy failure/invalid data stops before token mint or acquire", async () => {
  let touched = false;
  for (const resourcePolicy of [
    () => Promise.reject(new Error("settings read failed")),
    () => Promise.resolve({ cpuCores: 1, memoryMB: 1 }),
  ]) {
    const backend = new SandboxRpcBackend({
      inference: {
        mintRunToken: () => {
          touched = true;
          return "unexpected";
        },
        proxyUrl: "http://localhost:3210",
        revokeRunTokens: () => undefined,
      },
      provider: {
        acquire: () => {
          touched = true;
          return Promise.reject(new Error("unexpected"));
        },
        attach: () => Promise.reject(new Error("unexpected")),
        name: "test",
        release: () => Promise.resolve(),
      },
      remoteCliPath: resolveDefaultCliPath(),
      resourcePolicy,
    });
    // biome-ignore lint/performance/noAwaitInLoops: sequential failure probes share observation state
    await assert.rejects(backend.open(await makeSpec()));
  }
  assert.equal(touched, false);
});

test("fail-closed：acquire 失败原样上抛，绝不静默回退", async () => {
  const provider = new TestSandboxProvider();
  provider.failNextAcquires(1);
  const { env } = await fauxScriptEnv([]);
  const backend = new SandboxRpcBackend({
    env,
    extensions: [FAUX_EXTENSION_PATH],
    provider,
    remoteCliPath: resolveDefaultCliPath(),
  });
  await assert.rejects(
    backend.open(await makeSpec()),
    (error: unknown) => error instanceof SandboxUnavailableError
  );
  // 未 acquire 成功任何沙箱
  assert.equal(provider.acquiredSpecs.length, 0);
});

test("seeding 落 workspace：会话文件与 agentDir 上传，in-sandbox pi 全轮可跑", {
  timeout: TEST_TIMEOUT_MS,
}, async () => {
  const provider = new TestSandboxProvider();
  const { env } = await fauxScriptEnv([
    fauxAssistantMessage([fauxText("沙箱内回答")]),
  ]);
  const backend = new SandboxRpcBackend({
    env,
    extensions: [FAUX_EXTENSION_PATH],
    provider,
    remoteCliPath: resolveDefaultCliPath(),
  });
  const session = await backend.open(
    await makeSpec({ historyMessages: NON_EMPTY_HISTORY })
  );
  try {
    const sandbox = provider.sandbox("test-sbx-1");
    assert.ok(sandbox, "沙箱应已登记");
    const { handle } = sandbox;

    // agentDir 物化（PI_CODING_AGENT_DIR 目标目录）+ 会话 seeding
    // （非空历史含 assistant → 官方 _persist 规则落盘 → 上传）
    await handle.readFile("piwork/agentdir/.keep");
    const sessionJsonl = await handle.readFile("piwork/session.jsonl");
    const seededText = Buffer.from(sessionJsonl).toString("utf8");
    assert.ok(seededText.includes("历史回答"), "seeding 历史应上传");

    // 全轮：prompt → bridge → in-sandbox 官方 pi（安装位置直用）→ 事件流
    await session.send({ text: "你好", type: "prompt" });
    const events = await collect(session);
    assert.equal(events.at(-1)?.type, "run.settled");
    const text = events
      .filter(
        (event): event is Extract<RuntimeEvent, { type: "message.delta" }> =>
          event.type === "message.delta" &&
          event.channel === "text" &&
          event.phase === "delta"
      )
      .map((event) => event.delta ?? "")
      .join("");
    assert.equal(text, "沙箱内回答");
  } finally {
    await session.close("test-done");
  }
});

test("close：按 kill 策略释放（沙箱销毁、句柄 fail-closed）", {
  timeout: TEST_TIMEOUT_MS,
}, async () => {
  const provider = new TestSandboxProvider();
  const { env } = await fauxScriptEnv([]);
  const backend = new SandboxRpcBackend({
    env,
    extensions: [FAUX_EXTENSION_PATH],
    provider,
    remoteCliPath: resolveDefaultCliPath(),
  });
  const session = await backend.open(await makeSpec());
  const handle = provider.sandbox("test-sbx-1")?.handle;
  assert.ok(handle);
  await session.close("test-done");
  assert.equal(await handle.status(), "destroyed");
  await assert.rejects(
    async () => handle.readFile("piwork/session.jsonl"),
    (error: unknown) => error instanceof SandboxUnavailableError
  );
});

test("deliver_file 全链路：沙箱内 extension 落 outbox → 宿主收割出站归档", {
  timeout: TEST_TIMEOUT_MS,
}, async () => {
  const provider = new TestSandboxProvider();
  const chatId = "00000000-0000-0000-0000-0000000000d1";
  const workspaceDir = await mkdtemp(path.join(tmpdir(), "piwork-sbx-ws-"));
  // 模型：先调 deliver_file（extension 校验 + 落 manifest），再收尾文本
  const { env } = await fauxScriptEnv([
    fauxAssistantMessage([
      fauxToolCall("deliver_file", { path: "out/report.txt" }),
    ]),
    fauxAssistantMessage([fauxText("已交付")]),
  ]);
  const storedFiles: StoredFile[] = [];
  const archived: Array<{ chatId: string; size: number }> = [];
  const backend = new SandboxRpcBackend({
    archiveFile: (archiveChatId, _file, size) => {
      archived.push({ chatId: archiveChatId, size });
      return Promise.resolve();
    },
    env,
    extensions: [FAUX_EXTENSION_PATH],
    provider,
    remoteCliPath: resolveDefaultCliPath(),
    store: (input) => {
      const stored: StoredFile = {
        contentType: input.contentType,
        name: input.filename,
        pathname: `blob/${input.filename}`,
        url: `https://blob.test/${input.filename}`,
      };
      storedFiles.push(stored);
      return Promise.resolve(stored);
    },
  });
  const session = await backend.open(await makeSpec({ chatId, workspaceDir }));
  try {
    const handle = provider.sandbox("test-sbx-1")?.handle;
    assert.ok(handle);
    // 沙箱内产物（模拟 agent 先写出的文件；「报告」UTF-8 6 字节）
    const payload = new TextEncoder().encode("报告");
    await handle.writeFile("out/report.txt", payload);

    // 全量排空（不 break 于终态：artifact.created 可能晚于 tool.completed、
    // 由 close 前的 gateway flush 落进仍开放的 queue）
    const events: RuntimeEvent[] = [];
    const drained = (async () => {
      for await (const event of session.events()) {
        events.push(event);
      }
    })();
    await session.send({ text: "生成交付", type: "prompt" });
    await waitForTerminal(events);
    await session.close("test-done");
    await drained;

    // 宿主侧：store + archive 带平台 chatId
    assert.equal(storedFiles.length, 1);
    assert.equal(storedFiles[0]?.name, "report.txt");
    assert.deepEqual(
      archived.map((entry) => entry.chatId),
      [chatId]
    );
    assert.equal(archived[0]?.size, payload.byteLength);
    // 事件流：tool 完成 + artifact.created 均达
    assert.ok(
      events.some(
        (event) =>
          event.type === "tool.completed" && event.toolName === "deliver_file"
      ),
      "应有 deliver_file 工具完成事件"
    );
    const artifact = events.find(
      (event): event is Extract<RuntimeEvent, { type: "artifact.created" }> =>
        event.type === "artifact.created"
    );
    assert.ok(artifact, "应收割出 artifact.created");
    assert.equal(artifact.file.filename, "report.txt");
    assert.equal(artifact.file.url, "https://blob.test/report.txt");
    assert.equal(events.at(-1)?.type, "run.settled");
  } finally {
    await session.close("test-done").catch(() => undefined);
  }
});

/** 轮询等待事件流出现终态（faux 响应流式产生，存在真实时间差） */
function waitForTerminal(events: RuntimeEvent[]): Promise<void> {
  const terminal = (event: RuntimeEvent) =>
    event.type === "run.settled" || event.type === "run.failed";
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 30_000;
    const tick = () => {
      if (events.some(terminal)) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error("waitForTerminal: 30s 内未见终态事件"));
        return;
      }
      setTimeout(tick, 25);
    };
    tick();
  });
}
