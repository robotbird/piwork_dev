import "./test-env";
import assert from "node:assert/strict";
import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import {
  type FauxResponseStep,
  fauxAssistantMessage,
  fauxText,
  fauxThinking,
  fauxToolCall,
  Type,
} from "@earendil-works/pi-ai";
import { getPiModel, getTestFauxHandle } from "@/lib/ai/pi";
import type { RuntimeEvent, RuntimeSession, RuntimeSpec } from "../protocol";
import { InMemoryBackend, type InMemoryScriptStep } from "./in-memory/backend";
import { InProcessBackend } from "./in-process/backend";

/**
 * Runtime backend 契约测试（v2.0 §10 Step 1）：同一套用例跑 InMemory（脚本
 * 替身）与 InProcess（faux provider 驱动真实 AgentSession），证明 seam 两侧
 * 产出相同的规范化事件流。断言用 outline 投影——丢弃 delta 相位，使断言与
 * faux 的分块粒度（tokenSize 3–5）无关。
 */

const TEST_TIMEOUT_MS = 60_000;
const TEST_MODEL_ID = "deepseek/deepseek-flash";

type Scenario = {
  /** InProcess：faux 响应队列（FIFO，工具轮后 provider 会再取一次） */
  fauxSteps?: FauxResponseStep[];
  /** InMemory：每次 prompt 播放的事件脚本 */
  inMemorySteps?: InMemoryScriptStep[];
  tools?: AgentTool[];
  workspaceDir?: string | null;
};

type Harness = {
  name: string;
  openSession: (scenario: Scenario) => Promise<RuntimeSession>;
};

let cachedModel: RuntimeSpec["model"] | undefined;

async function testModel(): Promise<RuntimeSpec["model"]> {
  cachedModel ??= await getPiModel(TEST_MODEL_ID);
  return cachedModel;
}

async function makeSpec(scenario: Scenario): Promise<RuntimeSpec> {
  return {
    appendSystemPrompt: [],
    chatId: "00000000-0000-0000-0000-000000000001",
    historyMessages: [],
    model: await testModel(),
    systemPrompt: "piwork runtime contract test",
    tools: scenario.tools ?? [],
    workspaceDir: scenario.workspaceDir ?? null,
  };
}

const harnesses: Harness[] = [
  {
    name: "InMemory",
    openSession: async (scenario) => {
      const backend = new InMemoryBackend({
        onPrompt: () => scenario.inMemorySteps ?? [],
      });
      return backend.open(await makeSpec(scenario));
    },
  },
  {
    name: "InProcess",
    openSession: async (scenario) => {
      const faux = getTestFauxHandle();
      assert.ok(faux, "InProcess 契约测试需在测试环境运行（faux 未注册）");
      faux.setResponses(scenario.fauxSteps ?? []);
      const backend = new InProcessBackend();
      return backend.open(await makeSpec(scenario));
    },
  },
];

/** 排空事件流直到终态（run.settled/failed） */
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

/** 与分块粒度无关的事件骨架 */
function outline(events: RuntimeEvent[]): string[] {
  const lines: string[] = [];
  for (const event of events) {
    switch (event.type) {
      case "run.started":
        lines.push("run.started");
        break;
      case "run.settled":
        lines.push("run.settled");
        break;
      case "run.failed":
        lines.push("run.failed");
        break;
      case "message.started":
        lines.push(`message.started:${event.sequence}`);
        break;
      case "message.completed":
        lines.push(`message.completed:${event.sequence}`);
        break;
      case "message.delta":
        if (event.phase !== "delta") {
          lines.push(
            `delta:${event.channel}:${event.sequence}-${event.contentIndex}:${event.phase}`
          );
        }
        break;
      case "tool.started":
        lines.push(`tool.started:${event.toolName}`);
        break;
      case "tool.completed":
        lines.push(`tool.completed:${event.toolName}:err=${event.isError}`);
        break;
      default:
        lines.push(event.type);
        break;
    }
  }
  return lines;
}

type DeltaEvent = Extract<RuntimeEvent, { type: "message.delta" }>;

function concatDeltas(
  events: RuntimeEvent[],
  channel: "text" | "reasoning"
): string {
  return events
    .filter(
      (event): event is DeltaEvent =>
        event.type === "message.delta" &&
        event.channel === channel &&
        event.phase === "delta"
    )
    .map((event) => event.delta ?? "")
    .join("");
}

const echoTool: AgentTool = {
  description: "Echo the given text back.",
  execute: async (_toolCallId, params) => ({
    content: [
      { text: `echo: ${(params as { text: string }).text}`, type: "text" },
    ],
    details: undefined,
  }),
  label: "Echo test",
  name: "echo_test",
  parameters: Type.Object({ text: Type.String() }),
};

/** 场景 1：text + reasoning 的完整事件序列 */
function textReasoningScenario(): Scenario {
  return {
    fauxSteps: [
      fauxAssistantMessage([fauxThinking("思考内容"), fauxText("你好，世界")]),
    ],
    inMemorySteps: [
      { event: { sequence: 1, type: "message.started" } },
      {
        event: {
          channel: "reasoning",
          contentIndex: 0,
          phase: "start",
          sequence: 1,
          type: "message.delta",
        },
      },
      {
        event: {
          channel: "reasoning",
          contentIndex: 0,
          delta: "思考内容",
          phase: "delta",
          sequence: 1,
          type: "message.delta",
        },
      },
      {
        event: {
          channel: "reasoning",
          contentIndex: 0,
          phase: "end",
          sequence: 1,
          type: "message.delta",
        },
      },
      {
        event: {
          channel: "text",
          contentIndex: 1,
          phase: "start",
          sequence: 1,
          type: "message.delta",
        },
      },
      {
        event: {
          channel: "text",
          contentIndex: 1,
          delta: "你好，世界",
          phase: "delta",
          sequence: 1,
          type: "message.delta",
        },
      },
      {
        event: {
          channel: "text",
          contentIndex: 1,
          phase: "end",
          sequence: 1,
          type: "message.delta",
        },
      },
      { event: { sequence: 1, type: "message.completed" } },
    ],
  };
}

/** 场景 2：工具轮（toolcall → 工具执行 → 第二轮文本） */
function toolRoundScenario(sawToolResult?: { value: boolean }): Scenario {
  return {
    fauxSteps: [
      fauxAssistantMessage([fauxToolCall("echo_test", { text: "hi" })], {
        stopReason: "toolUse",
      }),
      (context) => {
        if (sawToolResult) {
          sawToolResult.value = context.messages.some(
            (message) => message.role === "toolResult"
          );
        }
        return fauxAssistantMessage("完成");
      },
    ],
    inMemorySteps: [
      { event: { sequence: 1, type: "message.started" } },
      {
        event: {
          channel: "tool",
          contentIndex: 0,
          phase: "start",
          sequence: 1,
          type: "message.delta",
        },
      },
      {
        event: {
          channel: "tool",
          contentIndex: 0,
          delta: "{}",
          phase: "delta",
          sequence: 1,
          type: "message.delta",
        },
      },
      {
        event: {
          channel: "tool",
          contentIndex: 0,
          phase: "end",
          sequence: 1,
          type: "message.delta",
        },
      },
      { event: { sequence: 1, type: "message.completed" } },
      {
        event: {
          args: { text: "hi" },
          toolCallId: "tc1",
          toolName: "echo_test",
          type: "tool.started",
        },
      },
      {
        event: {
          isError: false,
          toolCallId: "tc1",
          toolName: "echo_test",
          type: "tool.completed",
        },
      },
      { event: { sequence: 2, type: "message.started" } },
      {
        event: {
          channel: "text",
          contentIndex: 0,
          phase: "start",
          sequence: 2,
          type: "message.delta",
        },
      },
      {
        event: {
          channel: "text",
          contentIndex: 0,
          delta: "完成",
          phase: "delta",
          sequence: 2,
          type: "message.delta",
        },
      },
      {
        event: {
          channel: "text",
          contentIndex: 0,
          phase: "end",
          sequence: 2,
          type: "message.delta",
        },
      },
      { event: { sequence: 2, type: "message.completed" } },
    ],
    tools: [echoTool],
  };
}

async function artifactScenario(): Promise<Scenario> {
  const workspaceDir = await mkdtemp(path.join(tmpdir(), "piwork-ws-"));
  await writeFile(path.join(workspaceDir, "report.txt"), "报告内容");
  const artifactEvent: RuntimeEvent = {
    file: {
      contentType: "text/plain",
      filename: "report.txt",
      url: "/api/files/report-test",
    },
    type: "artifact.created",
  };
  return {
    fauxSteps: [
      fauxAssistantMessage(
        [fauxToolCall("deliver_file", { path: "report.txt" })],
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage("已交付"),
    ],
    inMemorySteps: [
      { event: { sequence: 1, type: "message.started" } },
      {
        event: {
          args: { path: "report.txt" },
          toolCallId: "tc-file",
          toolName: "deliver_file",
          type: "tool.started",
        },
      },
      { event: artifactEvent },
      {
        event: {
          isError: false,
          toolCallId: "tc-file",
          toolName: "deliver_file",
          type: "tool.completed",
        },
      },
      { event: { sequence: 1, type: "message.completed" } },
    ],
    workspaceDir,
  };
}

function failureScenario(): Scenario {
  return {
    fauxSteps: Array.from({ length: 5 }, () =>
      // 重复多条：测试环境未写 retry 配置，容错默认重试耗尽后仍以 boom 失败
      fauxAssistantMessage([], { errorMessage: "boom", stopReason: "error" })
    ),
    inMemorySteps: [
      { event: { error: "boom", runId: "", type: "run.failed" } },
    ],
  };
}

function longStreamScenario(): Scenario {
  return {
    fauxSteps: [fauxAssistantMessage("x".repeat(6000))],
    inMemorySteps: [
      { delayMs: 10_000, event: { sequence: 1, type: "message.started" } },
    ],
  };
}

for (const harness of harnesses) {
  test(`[${harness.name}] text+reasoning 事件序列与 delta 内容`, {
    timeout: TEST_TIMEOUT_MS,
  }, async () => {
    const session = await harness.openSession(textReasoningScenario());
    try {
      await session.send({ text: "你好", type: "prompt" });
      const events = await collect(session);
      assert.deepEqual(outline(events), [
        "run.started",
        "message.started:1",
        "delta:reasoning:1-0:start",
        "delta:reasoning:1-0:end",
        "delta:text:1-1:start",
        "delta:text:1-1:end",
        "message.completed:1",
        "run.settled",
      ]);
      assert.equal(concatDeltas(events, "reasoning"), "思考内容");
      assert.equal(concatDeltas(events, "text"), "你好，世界");
      assert.ok(
        !events.some(
          (event) =>
            event.type === "tool.started" || event.type === "artifact.created"
        )
      );
      assert.equal((await session.snapshot()).status, "idle");
    } finally {
      await session.close("test-done");
    }
  });

  test(`[${harness.name}] 工具轮：toolcall → 执行 → 第二轮文本`, {
    timeout: TEST_TIMEOUT_MS,
  }, async () => {
    const sawToolResult = { value: false };
    const session = await harness.openSession(
      toolRoundScenario(
        harness.name === "InProcess" ? sawToolResult : undefined
      )
    );
    try {
      await session.send({ text: "调用工具", type: "prompt" });
      const events = await collect(session);
      assert.deepEqual(outline(events), [
        "run.started",
        "message.started:1",
        "delta:tool:1-0:start",
        "delta:tool:1-0:end",
        "message.completed:1",
        "tool.started:echo_test",
        "tool.completed:echo_test:err=false",
        "message.started:2",
        "delta:text:2-0:start",
        "delta:text:2-0:end",
        "message.completed:2",
        "run.settled",
      ]);
      assert.equal(concatDeltas(events, "text"), "完成");
      if (harness.name === "InProcess") {
        // 工具结果确实回灌进了下一轮 provider 调用
        assert.ok(sawToolResult.value);
      }
    } finally {
      await session.close("test-done");
    }
  });

  test(`[${harness.name}] artifact.created 严格位于 tool.started 与 tool.completed 之间`, {
    timeout: TEST_TIMEOUT_MS,
  }, async () => {
    const scenario = await artifactScenario();
    const session = await harness.openSession(scenario);
    try {
      await session.send({ text: "交付报告", type: "prompt" });
      const events = await collect(session);
      const artifact = events.findIndex((e) => e.type === "artifact.created");
      const started = events.findIndex(
        (e) => e.type === "tool.started" && e.toolName === "deliver_file"
      );
      const completed = events.findIndex(
        (e) => e.type === "tool.completed" && e.toolName === "deliver_file"
      );
      assert.ok(started >= 0, "缺少 deliver_file 的 tool.started");
      assert.ok(completed >= 0, "缺少 deliver_file 的 tool.completed");
      assert.ok(
        started < artifact && artifact < completed,
        `artifact.created 应在 (${started}, ${completed}) 内，实际 ${artifact}`
      );
      if (harness.name === "InProcess") {
        const artifactEvent = events[artifact] as Extract<
          RuntimeEvent,
          { type: "artifact.created" }
        >;
        assert.equal(artifactEvent.file.filename, "report.txt");
        assert.ok(artifactEvent.file.url);
        // storeFile 本地回退落进 tmp UPLOAD_DIR
        const uploads = await readdir(process.env.UPLOAD_DIR as string);
        assert.ok(uploads.length > 0, "UPLOAD_DIR 应有落盘文件");
      }
    } finally {
      await session.close("test-done");
    }
  });

  test(`[${harness.name}] abort：终态恒为 run.settled，快照 aborted`, {
    timeout: TEST_TIMEOUT_MS,
  }, async () => {
    const session = await harness.openSession(longStreamScenario());
    try {
      await session.send({ text: "长回复", type: "prompt" });
      setTimeout(() => {
        session.send({ type: "abort" }).catch(() => undefined);
      }, 200);
      const events = await collect(session);
      const terminal = events.at(-1);
      assert.equal(terminal?.type, "run.settled");
      assert.ok(
        !events.some((event) => event.type === "run.failed"),
        "abort 后不得出现 run.failed"
      );
      assert.equal((await session.snapshot()).status, "aborted");
    } finally {
      await session.close("test-done");
    }
  });

  test(`[${harness.name}] 失败：run.failed 携带错误且无 settled`, {
    timeout: TEST_TIMEOUT_MS,
  }, async () => {
    const session = await harness.openSession(failureScenario());
    try {
      await session.send({ text: "触发失败", type: "prompt" });
      const events = await collect(session);
      const terminal = events.at(-1);
      assert.equal(terminal?.type, "run.failed");
      assert.match(
        (terminal as Extract<RuntimeEvent, { type: "run.failed" }>).error,
        /boom/
      );
      assert.ok(!events.some((event) => event.type === "run.settled"));
      const snapshot = await session.snapshot();
      assert.equal(snapshot.status, "failed");
      assert.match(snapshot.errorMessage ?? "", /boom/);
    } finally {
      await session.close("test-done");
    }
  });

  test(`[${harness.name}] close 幂等：close 后 send 被拒、快照 closed`, {
    timeout: TEST_TIMEOUT_MS,
  }, async () => {
    const session = await harness.openSession(textReasoningScenario());
    await session.send({ text: "你好", type: "prompt" });
    await collect(session);
    await session.close("done");
    await session.close("again");
    assert.equal((await session.snapshot()).status, "closed");
    assert.equal((await session.send({ type: "abort" })).ok, false);
  });

  test(`[${harness.name}] events() 单消费者且 cursor 未支持`, {
    timeout: TEST_TIMEOUT_MS,
  }, async () => {
    const session = await harness.openSession({});
    try {
      assert.ok(session.events());
      assert.throws(() => session.events());
      assert.throws(() => session.events("cursor-0"));
    } finally {
      await session.close("test-done");
    }
  });

  test(`[${harness.name}] clearQueue 在空闲态 ack ok`, {
    timeout: TEST_TIMEOUT_MS,
  }, async () => {
    const session = await harness.openSession({});
    try {
      const ack = await session.send({ type: "clearQueue" });
      assert.deepEqual(ack, { ok: true });
    } finally {
      await session.close("test-done");
    }
  });
}

test("InMemory steer/followUp：ack ok 且命令被记录", async () => {
  const backend = new InMemoryBackend();
  const session = await backend.open(await makeSpec({}));
  try {
    assert.deepEqual(await session.send({ text: "转向", type: "steer" }), {
      ok: true,
    });
    assert.deepEqual(await session.send({ text: "追问", type: "followUp" }), {
      ok: true,
    });
    assert.deepEqual(
      backend.sessions[0]?.commands.map((c) => c.type),
      ["steer", "followUp"]
    );
  } finally {
    await session.close("test-done");
  }
});
