import "../../../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import {
  fauxAssistantMessage,
  type AssistantMessage,
  type TextContent,
  type Usage,
} from "@earendil-works/pi-ai";
import type { SnapshotEvent } from "@earendil-works/pi-durable";
import { DurableEventNormalizer } from "../../../../../lib/runtime/backends/durable/event-normalizer";
import type { RuntimeEvent } from "../../../../../lib/runtime/protocol";

const usage: Usage = {
  cacheRead: 0,
  cacheWrite: 0,
  cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0 },
  input: 0,
  output: 0,
  totalTokens: 0,
};

function assistantMessage(content: AssistantMessage["content"]): AssistantMessage {
  return { ...fauxAssistantMessage(""), content };
}

function textBlock(text: string): TextContent {
  return { type: "text", text };
}

/** 官方 watch overflow 契约：以 snapshot 帧顶替未送达批次 */
function snapshotWith(content: AssistantMessage["content"]): SnapshotEvent {
  return {
    generation: { attempt: 1, message: assistantMessage(content) },
    type: "snapshot",
  } as SnapshotEvent;
}

/** 块事件投影：channel:phase(delta)，非块事件用 type */
function outline(events: RuntimeEvent[]): string[] {
  return events.map((event) =>
    event.type === "message.delta"
      ? `${event.channel}:${event.phase}${
          event.delta === undefined ? "" : `(${event.delta})`
        }`
      : event.type
  );
}

test("delta for a block without start synthesizes start before the delta", () => {
  const normalizer = new DurableEventNormalizer();
  normalizer.feed({ message: assistantMessage([]), type: "message_start" });
  assert.deepEqual(
    outline(
      normalizer.feed({
        changes: [{ contentIndex: 0, delta: "晚", type: "text_delta" } as const],
        type: "message_update",
        usage,
      })
    ),
    ["text:start", "text:delta(晚)"]
  );
});

test("delta after the block closed reopens it instead of emitting an orphan delta", () => {
  const normalizer = new DurableEventNormalizer();
  normalizer.feed({
    message: assistantMessage([textBlock("ab")]),
    type: "message_start",
  });
  normalizer.feed({
    changes: [{ block: textBlock("ab"), contentIndex: 0, type: "block" }],
    type: "message_update",
    usage,
  });
  assert.deepEqual(
    outline(
      normalizer.feed({
        changes: [{ contentIndex: 0, delta: "cd", type: "text_delta" } as const],
        type: "message_update",
        usage,
      })
    ),
    ["text:start", "text:delta(cd)"]
  );
});

test("snapshot frame backfills deltas dropped by watch overflow", () => {
  const normalizer = new DurableEventNormalizer();
  normalizer.feed({
    message: assistantMessage([textBlock("ab")]),
    type: "message_start",
  });
  assert.deepEqual(
    outline(normalizer.feed(snapshotWith([textBlock("abcdef")]))),
    ["text:delta(cdef)"]
  );
  assert.deepEqual(
    outline(
      normalizer.feed({
        changes: [{ contentIndex: 0, delta: "g", type: "text_delta" } as const],
        type: "message_update",
        usage,
      })
    ),
    ["text:delta(g)"]
  );
});

test("snapshot frame restarts blocks whose start was dropped", () => {
  const normalizer = new DurableEventNormalizer();
  normalizer.feed({ message: assistantMessage([]), type: "message_start" });
  assert.deepEqual(
    outline(normalizer.feed(snapshotWith([textBlock("hello")]))),
    ["text:start", "text:delta(hello)"]
  );
});

test("snapshot frame keeps closed blocks closed", () => {
  const normalizer = new DurableEventNormalizer();
  normalizer.feed({
    message: assistantMessage([textBlock("ab")]),
    type: "message_start",
  });
  normalizer.feed({
    changes: [{ block: textBlock("ab"), contentIndex: 0, type: "block" }],
    type: "message_update",
    usage,
  });
  assert.deepEqual(
    outline(normalizer.feed(snapshotWith([textBlock("ab")]))),
    []
  );
});
