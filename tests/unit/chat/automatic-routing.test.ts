import "../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import { classifyExecution } from "../../../lib/ai/execution-classifier";
import {
  chatNeedsCompatibility,
  selectChatRuntime,
} from "../../../lib/runtime/backends/routing/chat-routing";
import type { ChatMessage } from "../../../lib/types";

const base = {
  approvalContinuation: false,
  classificationReason: "heuristic",
  durableEnabled: true,
  needsCompatibility: false,
  requiresExecution: true,
  skillCommand: false,
};
test("routing is automatic: lightweight normal, portable execution Durable, compatibility normal", () => {
  assert.equal(selectChatRuntime(base).lane, "durable_sandbox");
  for (const patch of [
    { requiresExecution: false },
    { durableEnabled: false },
    { approvalContinuation: true },
    { skillCommand: true },
    { needsCompatibility: true },
    { classificationReason: "uncertain" },
    { classificationReason: "unavailable" },
  ]) {
    assert.equal(selectChatRuntime({ ...base, ...patch }).lane, "default");
  }
});
test("reuse official/local execution classifier before selecting backend", async () => {
  for (const [message, attachmentCount, expected] of [
    ["你好", 0, "default"],
    ["请执行 bash 命令生成 hello.txt 并交付下载", 0, "durable_sandbox"],
    ["请处理附件", 1, "durable_sandbox"],
  ] as const) {
    // biome-ignore lint/performance/noAwaitInLoops: three independent routing assertions, not a load test
    const decision = await classifyExecution(
      { attachmentCount, history: [], message },
      { modelRef: "" }
    );
    assert.equal(
      selectChatRuntime({
        ...base,
        classificationReason: decision.reason,
        requiresExecution: decision.requiresExecution,
      }).lane,
      expected
    );
  }
});
test("known integrations, platform requests and preceding tool calls retain compatibility", () => {
  for (const message of [
    "调用 MCP 获取数据",
    "/skill report",
    "使用技能生成文件",
    "请每天9点提醒我",
    "联网搜索资料",
    "use my-custom-tool",
  ]) {
    assert.equal(
      chatNeedsCompatibility({
        capabilityNames: ["my-custom-tool"],
        history: [],
        message,
      }),
      true
    );
  }
  const history: ChatMessage[] = [
    {
      id: crypto.randomUUID(),
      parts: [
        { toolName: "custom-platform-tool", type: "dynamic-tool" } as never,
      ],
      role: "assistant",
    },
  ];
  assert.equal(
    chatNeedsCompatibility({ capabilityNames: [], history, message: "继续" }),
    true
  );
  assert.equal(
    chatNeedsCompatibility({
      capabilityNames: ["unrelated-mcp"],
      history: [],
      message: "请执行 bash 生成 hello.txt 并交付",
    }),
    false
  );
  history[0].parts = [{ type: "tool-bash" } as never];
  assert.equal(
    chatNeedsCompatibility({ capabilityNames: [], history, message: "继续" }),
    false
  );
});
