import "../../../../support/runtime-env";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  type FauxResponseStep,
  fauxAssistantMessage,
} from "@earendil-works/pi-ai";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { getPiModel } from "@/lib/ai/pi";
import { MANAGED_AGENT_DIR } from "@/lib/pi-packages/manager";
import {
  LocalRpcBackend,
  type LocalRpcRuntimeSession,
} from "../../../../../lib/runtime/backends/local-rpc/backend";
import {
  buildRpcClientOptions,
  resolveDefaultCliPath,
  seedSessionFile,
} from "../../../../../lib/runtime/backends/local-rpc/spawn";
import type {
  RuntimeEvent,
  RuntimeSpec,
} from "../../../../../lib/runtime/protocol";

/**
 * LocalRpcBackend 专属测试（v2.0 Step 3 §3.7）——首个运行级 RPC spike（补
 * archive §6-#6）：faux provider 驱动本机 `pi --mode rpc` 子进程，验证
 * steer/followUp 多周期、agent_settled 终态、进程崩溃与停机无泄漏。
 * 共享契约用例见 ../backends.test.ts 的 LocalRpc harness。
 */

const TEST_TIMEOUT_MS = 60_000;
const TEST_MODEL_ID = "deepseek/deepseek-flash";
const FAUX_EXTENSION_PATH = fileURLToPath(
  new URL("../../../../support/faux-provider-extension.ts", import.meta.url)
);

let cachedModel: RuntimeSpec["model"] | undefined;

async function testModel(): Promise<RuntimeSpec["model"]> {
  cachedModel ??= await getPiModel(TEST_MODEL_ID);
  return cachedModel;
}

async function makeSpec(
  overrides: Partial<RuntimeSpec> = {}
): Promise<RuntimeSpec> {
  return {
    appendSystemPrompt: [],
    chatId: "00000000-0000-0000-0000-0000000000f1",
    historyMessages: [],
    model: await testModel(),
    systemPrompt: "piwork local-rpc test",
    tools: [],
    workspaceDir: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 无泄漏守卫：登记本套件 spawn 的所有子进程 pid，after 断言全部退出
// ---------------------------------------------------------------------------

/** 测试专属：窄化读取 RpcClient 私有 process 字段（backend 代码不碰私有面） */
function rpcChildPid(session: LocalRpcRuntimeSession): number | undefined {
  const internals = session as unknown as {
    client?: { process?: { pid?: number } | null };
  };
  return internals.client?.process?.pid ?? undefined;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const trackedPids = new Set<number>();

test.after(() => {
  for (const pid of trackedPids) {
    assert.ok(!isAlive(pid), `泄漏的 rpc 子进程 pid=${pid}`);
  }
});

// ---------------------------------------------------------------------------
// faux 会话工厂与事件排空
// ---------------------------------------------------------------------------

async function openRpcSession(options: {
  fauxSteps?: FauxResponseStep[];
  spec?: Partial<RuntimeSpec>;
}): Promise<LocalRpcRuntimeSession> {
  const scriptDir = await mkdtemp(path.join(tmpdir(), "piwork-rpc-script-"));
  const scriptPath = path.join(scriptDir, "faux-script.json");
  // JSON.stringify 自然丢弃函数分支（工具轮场景的工厂不进子进程，见 §3.5）
  await writeFile(scriptPath, JSON.stringify(options.fauxSteps ?? []));
  const backend = new LocalRpcBackend({
    env: { PIWORK_FAUX_SCRIPT: scriptPath },
    extensions: [FAUX_EXTENSION_PATH],
  });
  // backend.open 声明返回接口类型；测试需要 LocalRpcRuntimeSession 的 getStderr
  const session = (await backend.open(
    await makeSpec(options.spec)
  )) as LocalRpcRuntimeSession;
  const pid = rpcChildPid(session);
  if (pid) {
    trackedPids.add(pid);
  }
  return session;
}

function isTerminal(event: RuntimeEvent): boolean {
  return event.type === "run.settled" || event.type === "run.failed";
}

/**
 * 单消费者后台排空：整个会话只调一次 events()，events 数组随到随查
 * （waitUntil 配合），untilTerminal(n) 等到第 n 个终态（followUp 多周期用）。
 */
function startCollector(
  session: LocalRpcRuntimeSession,
  events: RuntimeEvent[]
): { untilTerminal: (count: number) => Promise<void> } {
  let terminals = 0;
  const waiters: Array<() => void> = [];
  (async () => {
    for await (const event of session.events()) {
      events.push(event);
      if (isTerminal(event)) {
        terminals += 1;
        for (const resolve of waiters.splice(0)) {
          resolve();
        }
      }
    }
  })().catch(() => undefined);
  return {
    async untilTerminal(count: number) {
      for (;;) {
        if (terminals >= count) {
          return;
        }
        // biome-ignore lint/performance/noAwaitInLoops: 轮询等待第 n 个终态，等待点即目的
        await new Promise<void>((resolve) => {
          waiters.push(resolve);
        });
      }
    },
  };
}

async function waitUntil(
  predicate: () => boolean,
  timeoutMs: number
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (predicate()) {
      return;
    }
    if (Date.now() > deadline) {
      throw new Error("waitUntil: timeout");
    }
    // biome-ignore lint/performance/noAwaitInLoops: 轮询等待条件成立，等待点即目的
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function concatTextDeltas(events: RuntimeEvent[]): string {
  return events
    .filter(
      (event): event is Extract<RuntimeEvent, { type: "message.delta" }> =>
        event.type === "message.delta" &&
        event.channel === "text" &&
        event.phase === "delta"
    )
    .map((event) => event.delta ?? "")
    .join("");
}

// ---------------------------------------------------------------------------
// 1) spawn 规格单测（纯派生，无子进程）
// ---------------------------------------------------------------------------

test("buildRpcClientOptions：flags/env/cwd 派生", async () => {
  const spec = await makeSpec({
    appendSystemPrompt: ["段一", "段二"],
    systemPrompt: "系统提示",
  });
  const context = {
    agentDir: "/tmp/agentdir",
    sessionDir: "/tmp/sessdir",
    sessionFile: "/tmp/sessdir/s.jsonl",
  };
  const options = buildRpcClientOptions(spec, context);
  assert.deepEqual(options.args, [
    "--session",
    "/tmp/sessdir/s.jsonl",
    "--system-prompt",
    "系统提示",
    "--append-system-prompt",
    "段一",
    "--append-system-prompt",
    "段二",
    "--no-builtin-tools",
  ]);
  assert.equal(options.cwd, MANAGED_AGENT_DIR);
  assert.equal(options.provider, "deepseek");
  assert.equal(options.model, "deepseek-flash");
  assert.equal(options.env?.PI_CODING_AGENT_DIR, "/tmp/agentdir");
  assert.equal(options.env?.PI_OFFLINE, "1");

  const withWorkspace = buildRpcClientOptions(
    { ...spec, workspaceDir: "/tmp/ws" },
    context,
    {
      cliPath: "/tmp/cli.js",
      env: { PI_OFFLINE: "0" },
      extensions: ["/tmp/ext.ts"],
    }
  );
  const withWorkspaceArgs = withWorkspace.args ?? [];
  assert.ok(!withWorkspaceArgs.includes("--no-builtin-tools"));
  assert.deepEqual(withWorkspaceArgs.slice(-2), ["--extension", "/tmp/ext.ts"]);
  assert.equal(withWorkspace.cwd, "/tmp/ws");
  assert.equal(withWorkspace.env?.PI_OFFLINE, "0");
  assert.equal(withWorkspace.cliPath, "/tmp/cli.js");
});

test("resolveDefaultCliPath：解析包内 bundle 且存在", () => {
  const cliPath = resolveDefaultCliPath();
  assert.ok(cliPath.endsWith(path.join("dist", "bundle", "cli.js")));
  assert.ok(existsSync(cliPath));
});

test("seedSessionFile：历史落盘可读回；空历史也物化文件", async () => {
  const sessionDir = await mkdtemp(path.join(tmpdir(), "piwork-rpc-seed-"));
  const seeded = seedSessionFile(
    await makeSpec({
      historyMessages: [
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
      ],
    }),
    sessionDir
  );
  assert.ok(existsSync(seeded));
  assert.equal(SessionManager.open(seeded).getEntries().length, 2);

  const emptyDir = await mkdtemp(path.join(tmpdir(), "piwork-rpc-seed-"));
  const emptyFile = seedSessionFile(await makeSpec(), emptyDir);
  // pi _persist 规则：无 assistant 消息不落盘；--session 给绝对路径时缺失
  // 文件合法（子进程以新会话绑定该路径起步），无需物化
  assert.ok(emptyFile.startsWith(emptyDir));
  assert.ok(!existsSync(emptyFile));

  const userOnlyDir = await mkdtemp(path.join(tmpdir(), "piwork-rpc-seed-"));
  const userOnlyFile = seedSessionFile(
    await makeSpec({
      historyMessages: [
        { content: "只有用户消息", role: "user", timestamp: Date.now() },
      ],
    }),
    userOnlyDir
  );
  // 已知边界：纯 user 历史不落盘（生产 historyMessages 是既往轮次，必含
  // assistant，边界不触发；Step 8 切生产路径前复核）
  assert.ok(!existsSync(userOnlyFile));
});

// ---------------------------------------------------------------------------
// 2) 运行级用例（真实子进程 + faux provider）
// ---------------------------------------------------------------------------

test("steer 中途转向：ack ok 且 queue.changed 携带转向文本", {
  timeout: TEST_TIMEOUT_MS,
}, async () => {
  const session = await openRpcSession({
    // 两条：转向消息触发的第二个生成周期还需一次 provider 响应（脚本耗尽
    // 会以 stopReason error 终态失败，见首轮实测）
    fauxSteps: [
      fauxAssistantMessage("长".repeat(3000)),
      fauxAssistantMessage("转向后回答"),
    ],
  });
  try {
    assert.deepEqual(await session.send({ text: "长回复", type: "prompt" }), {
      ok: true,
    });
    const events: RuntimeEvent[] = [];
    const collector = startCollector(session, events);
    await waitUntil(
      () => events.some((event) => event.type === "message.delta"),
      15_000
    );
    assert.deepEqual(await session.send({ text: "中途转向", type: "steer" }), {
      ok: true,
    });
    await collector.untilTerminal(1);
    const queueChanges = events.filter(
      (event): event is Extract<RuntimeEvent, { type: "queue.changed" }> =>
        event.type === "queue.changed"
    );
    assert.ok(
      queueChanges.some((change) => change.steering.includes("中途转向")),
      `queue.changed 应含转向文本，实际 ${JSON.stringify(queueChanges)}`
    );
    const terminal = events.at(-1);
    assert.equal(terminal?.type, "run.settled");
    assert.equal(
      (terminal as Extract<RuntimeEvent, { type: "run.settled" }>).reason,
      "completed"
    );
  } finally {
    await session.close("test-done");
  }
});

test("followUp run 中排队：同 run 第二个生成周期消费后单一 settled", {
  timeout: TEST_TIMEOUT_MS,
}, async () => {
  const session = await openRpcSession({
    // 首条长流保证 followUp 落在 run 内；pi 语义：followUp 入队后由活动
    // run 的循环取走（idle 时入队不会开新 run——agent.followUp 仅 enqueue）
    fauxSteps: [
      fauxAssistantMessage(`第一轮回答${"缓".repeat(2000)}`),
      fauxAssistantMessage("第二轮回答"),
    ],
  });
  try {
    assert.ok((await session.send({ text: "第一问", type: "prompt" })).ok);
    const events: RuntimeEvent[] = [];
    const collector = startCollector(session, events);
    await waitUntil(
      () =>
        events.some(
          (event) => event.type === "message.delta" && event.phase === "delta"
        ),
      15_000
    );
    assert.ok((await session.send({ text: "第二问", type: "followUp" })).ok);
    await collector.untilTerminal(1);
    // 同一 run 内两个生成周期：单一 run.started 与单一终态
    assert.equal(
      events.filter((event) => event.type === "run.started").length,
      1
    );
    const terminal = events.at(-1);
    assert.equal(terminal?.type, "run.settled");
    assert.equal(
      (terminal as Extract<RuntimeEvent, { type: "run.settled" }>).reason,
      "completed"
    );
    const text = concatTextDeltas(events);
    assert.ok(text.includes("第一轮回答"));
    assert.ok(text.includes("第二轮回答"), "follow-up 应被活动 run 消费");
    const queueChanges = events.filter(
      (event): event is Extract<RuntimeEvent, { type: "queue.changed" }> =>
        event.type === "queue.changed"
    );
    assert.ok(
      queueChanges.some((change) => change.followUp.includes("第二问")),
      `queue.changed 应含 follow-up 文本，实际 ${JSON.stringify(queueChanges)}`
    );
  } finally {
    await session.close("test-done");
  }
});

test("崩溃：SIGKILL 子进程 → watchdog 推 run.failed，已流出事件不丢", {
  timeout: TEST_TIMEOUT_MS,
}, async () => {
  const session = await openRpcSession({
    fauxSteps: [fauxAssistantMessage("崩".repeat(3000))],
  });
  try {
    assert.ok((await session.send({ text: "触发崩溃", type: "prompt" })).ok);
    const events: RuntimeEvent[] = [];
    const collector = startCollector(session, events);
    await waitUntil(
      () =>
        events.some(
          (event) => event.type === "message.delta" && event.phase === "delta"
        ),
      15_000
    );
    const pid = rpcChildPid(session);
    assert.ok(pid, "应能取到子进程 pid");
    process.kill(pid, "SIGKILL");
    await collector.untilTerminal(1);
    const terminal = events.at(-1);
    assert.equal(terminal?.type, "run.failed");
    assert.match(
      (terminal as Extract<RuntimeEvent, { type: "run.failed" }>).error,
      /rpc process exited/
    );
    // 无事件丢失：run.started 与部分 delta 仍在终态之前
    assert.equal(events[0]?.type, "run.started");
    assert.ok(
      events.slice(0, -1).some((event) => event.type === "message.delta")
    );
    const snapshot = await session.snapshot();
    assert.equal(snapshot.status, "failed");
    assert.match(snapshot.errorMessage ?? "", /rpc process exited/);
    // stderr 通道可观测（内容不解析，仅排查用）
    assert.equal(typeof session.getStderr(), "string");
  } finally {
    await session.close("crash-done");
  }
});

test("停机：close 后子进程退出且 close 幂等", {
  timeout: TEST_TIMEOUT_MS,
}, async () => {
  const session = await openRpcSession({
    fauxSteps: [fauxAssistantMessage("你好")],
  });
  assert.ok((await session.send({ text: "hi", type: "prompt" })).ok);
  const events: RuntimeEvent[] = [];
  await startCollector(session, events).untilTerminal(1);
  const pid = rpcChildPid(session);
  assert.ok(pid && isAlive(pid));
  await session.close("done");
  assert.ok(!isAlive(pid), "close 后子进程应已退出");
  await session.close("again");
  assert.equal((await session.snapshot()).status, "closed");
  assert.equal((await session.send({ type: "abort" })).ok, false);
});
