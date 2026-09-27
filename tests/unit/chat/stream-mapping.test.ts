import assert from "node:assert/strict";
import test from "node:test";
import type { RuntimeEvent } from "@/lib/runtime/protocol";
import { runtimeEventToUIMessageChunks } from "../../../app/(chat)/api/chat/stream-mapping";

// 断言形状抄自重构前 route 的内联事件桥（wire JSON 深等于，防止回归漂移）
test("text 通道 delta 映射为 text-* chunk 且 id 规则不变", () => {
  const chunks = [
    ...runtimeEventToUIMessageChunks({
      channel: "text",
      contentIndex: 1,
      phase: "start",
      sequence: 2,
      type: "message.delta",
    }),
    ...runtimeEventToUIMessageChunks({
      channel: "text",
      contentIndex: 1,
      delta: "你好",
      phase: "delta",
      sequence: 2,
      type: "message.delta",
    }),
    ...runtimeEventToUIMessageChunks({
      channel: "text",
      contentIndex: 1,
      phase: "end",
      sequence: 2,
      type: "message.delta",
    }),
  ];
  assert.deepEqual(chunks, [
    { id: "text-2-1", type: "text-start" },
    { delta: "你好", id: "text-2-1", type: "text-delta" },
    { id: "text-2-1", type: "text-end" },
  ]);
});

test("reasoning 通道 delta 映射为 reasoning-* chunk", () => {
  const chunks = [
    ...runtimeEventToUIMessageChunks({
      channel: "reasoning",
      contentIndex: 0,
      phase: "start",
      sequence: 1,
      type: "message.delta",
    }),
    ...runtimeEventToUIMessageChunks({
      channel: "reasoning",
      contentIndex: 0,
      delta: "思考中",
      phase: "delta",
      sequence: 1,
      type: "message.delta",
    }),
    ...runtimeEventToUIMessageChunks({
      channel: "reasoning",
      contentIndex: 0,
      phase: "end",
      sequence: 1,
      type: "message.delta",
    }),
  ];
  assert.deepEqual(chunks, [
    { id: "reasoning-1-0", type: "reasoning-start" },
    { delta: "思考中", id: "reasoning-1-0", type: "reasoning-delta" },
    { id: "reasoning-1-0", type: "reasoning-end" },
  ]);
});

test("tool 通道 delta 不产出 wire chunk（仅驱动活跃标记）", () => {
  assert.deepEqual(
    runtimeEventToUIMessageChunks({
      channel: "tool",
      contentIndex: 0,
      phase: "start",
      sequence: 1,
      type: "message.delta",
    }),
    []
  );
});

test("工具开始/结束映射为 transient data-tool-status", () => {
  const started = runtimeEventToUIMessageChunks({
    args: { command: "python3 run.py" },
    toolCallId: "tc1",
    toolName: "bash",
    type: "tool.started",
  });
  assert.deepEqual(started, [
    {
      data: {
        message: "正在执行命令: python3 run.py",
        phase: "start",
        toolName: "bash",
      },
      transient: true,
      type: "data-tool-status",
    },
  ]);

  const ended = runtimeEventToUIMessageChunks({
    isError: false,
    toolCallId: "tc1",
    toolName: "bash",
    type: "tool.completed",
  });
  assert.deepEqual(ended, [
    {
      data: { message: "执行命令完成", phase: "end", toolName: "bash" },
      transient: true,
      type: "data-tool-status",
    },
  ]);

  const failed = runtimeEventToUIMessageChunks({
    isError: true,
    toolCallId: "tc2",
    toolName: "read",
    type: "tool.completed",
  });
  assert.deepEqual(failed, [
    {
      data: {
        isError: true,
        message: "读取文件失败",
        phase: "end",
        toolName: "read",
      },
      transient: true,
      type: "data-tool-status",
    },
  ]);
});

test("artifact.created 映射为非 transient data-delivered-file", () => {
  const file = {
    contentType: "text/plain",
    downloadUrl: "/download/abc",
    filename: "report.txt",
    url: "/files/abc",
  };
  assert.deepEqual(
    runtimeEventToUIMessageChunks({ file, type: "artifact.created" }),
    [{ data: file, type: "data-delivered-file" }]
  );
});

test("生命周期与控制事件不产出 wire chunk", () => {
  const silent: RuntimeEvent[] = [
    { runId: "r1", type: "run.started" },
    { runId: "r1", type: "run.settled" },
    { error: "boom", runId: "r1", type: "run.failed" },
    { sequence: 1, type: "message.started" },
    { sequence: 1, type: "message.completed" },
    { followUp: [], steering: [], type: "queue.changed" },
    { delta: "ls\n", type: "command.output" },
  ];
  for (const event of silent) {
    assert.deepEqual(runtimeEventToUIMessageChunks(event), []);
  }
});
