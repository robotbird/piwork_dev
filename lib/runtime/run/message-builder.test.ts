import "../backends/test-env";
import assert from "node:assert/strict";
import test from "node:test";
import type { RuntimeEvent } from "../protocol";
import { buildAssistantMessageParts, deriveMessageId } from "./message-builder";

/** 构造 message.delta 事件的简写 */
function delta(
  channel: "text" | "reasoning" | "tool",
  sequence: number,
  contentIndex: number,
  phase: "start" | "delta" | "end",
  text?: string
): RuntimeEvent {
  return {
    channel,
    contentIndex,
    ...(phase === "delta" && text !== undefined ? { delta: text } : {}),
    phase,
    sequence,
    type: "message.delta",
  };
}

test("deriveMessageId：确定性 + 8-4-4-4-12 形状", () => {
  const runId = "0199aabb-ccdd-eeff-0011-223344556677";
  const id = deriveMessageId(runId);
  assert.match(
    id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
  );
  assert.equal(deriveMessageId(runId), id);
  assert.notEqual(deriveMessageId("0199aabb-ccdd-eeff-0011-223344556678"), id);
});

test("多 sequence/contentIndex：按 (channel,sequence,contentIndex) 分组累积", () => {
  const parts = buildAssistantMessageParts([
    { sequence: 1, type: "message.started" },
    delta("reasoning", 1, 0, "start"),
    delta("reasoning", 1, 0, "delta", "思考"),
    delta("reasoning", 1, 0, "delta", "内容"),
    delta("reasoning", 1, 0, "end"),
    delta("text", 1, 1, "start"),
    delta("text", 1, 1, "delta", "第一轮"),
    delta("text", 1, 1, "end"),
    { sequence: 1, type: "message.completed" },
    { sequence: 2, type: "message.started" },
    delta("text", 2, 0, "start"),
    delta("text", 2, 0, "delta", "第二轮"),
    delta("text", 2, 0, "end"),
    { sequence: 2, type: "message.completed" },
  ]);
  assert.deepEqual(parts, [
    { state: "done", text: "思考内容", type: "reasoning" },
    { state: "done", text: "第一轮", type: "text" },
    { state: "done", text: "第二轮", type: "text" },
  ]);
});

test("流式中（未收到 end）：state 保持 streaming", () => {
  const parts = buildAssistantMessageParts([
    delta("text", 1, 0, "start"),
    delta("text", 1, 0, "delta", "部分"),
  ]);
  assert.deepEqual(parts, [{ state: "streaming", text: "部分", type: "text" }]);
});

test("tool 通道 delta 不产生 part；artifact 事件追加 delivered-file", () => {
  const file = {
    contentType: "text/plain",
    filename: "report.txt",
    url: "/api/files/report",
  };
  const parts = buildAssistantMessageParts([
    delta("tool", 1, 0, "start"),
    delta("tool", 1, 0, "delta", "{}"),
    delta("tool", 1, 0, "end"),
    {
      args: { path: "report.txt" },
      toolCallId: "tc1",
      toolName: "deliver_file",
      type: "tool.started",
    },
    { file, type: "artifact.created" },
    {
      isError: false,
      toolCallId: "tc1",
      toolName: "deliver_file",
      type: "tool.completed",
    },
    delta("text", 2, 0, "start"),
    delta("text", 2, 0, "delta", "已交付"),
    delta("text", 2, 0, "end"),
  ]);
  assert.deepEqual(parts, [
    { data: file, type: "data-delivered-file" },
    { state: "done", text: "已交付", type: "text" },
  ]);
});

test("容错：缺 start 的 delta/end 被跳过，不抛错", () => {
  const parts = buildAssistantMessageParts([
    delta("text", 1, 0, "delta", "孤儿增量"),
    delta("text", 1, 0, "end"),
  ]);
  assert.deepEqual(parts, []);
});

test("空事件序列与终态事件：产出空 parts", () => {
  assert.deepEqual(
    buildAssistantMessageParts([
      { runId: "r1", type: "run.started" },
      { reason: "completed", runId: "r1", type: "run.settled" },
    ]),
    []
  );
  assert.deepEqual(buildAssistantMessageParts([]), []);
});
