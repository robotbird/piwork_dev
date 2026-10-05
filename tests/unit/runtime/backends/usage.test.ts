import "../../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import type { EntryRecord } from "@earendil-works/pi-durable";
import { DurableEventNormalizer } from "../../../../lib/runtime/backends/durable/event-normalizer";
import { PiEventNormalizer } from "../../../../lib/runtime/backends/pi-event-normalizer";
import { normalizeUsage } from "../../../../lib/runtime/backends/usage";
import { runtimeEventData } from "../../../../lib/runtime/run/event-store";

test("completed assistant messages preserve authoritative Pi usage totals", () => {
  const message = fauxAssistantMessage("Done");
  Object.assign(message.usage, {
    cacheRead: 30,
    cacheWrite: 40,
    input: 10,
    output: 20,
    reasoning: 5,
    totalTokens: 100,
  });
  message.provider = "test-provider";
  message.model = "requested-alias";
  message.responseModel = "actual-model-v2";
  const normalizer = new PiEventNormalizer();
  normalizer.feed({ message, type: "message_start" });
  const [event] = normalizer.feed({ message, type: "message_end" });
  assert.equal(event.type, "message.completed");
  if (event.type === "message.completed") {
    assert.deepEqual(event.model, {
      id: "requested-alias",
      provider: "test-provider",
      responseModel: "actual-model-v2",
    });
    assert.deepEqual(runtimeEventData(event).model, event.model);
    const durable = new DurableEventNormalizer();
    durable.feed({ message, type: "message_start" });
    const entry: EntryRecord = {
      conversationId: 1 as EntryRecord["conversationId"],
      id: 1 as EntryRecord["id"],
      kind: "assistant",
      model: [message],
    };
    const durableCompleted = durable
      .feed({ entry, type: "message_end" })
      .find((item) => item.type === "message.completed");
    assert.deepEqual(durableCompleted, event);
    assert.deepEqual(event.usage, {
      cacheRead: 30,
      cacheWrite: 40,
      input: 10,
      output: 20,
      totalTokens: 100,
    });
  }
});

test("missing or invalid usage remains unknown while reported zero is valid", () => {
  const zero = {
    cacheRead: 0,
    cacheWrite: 0,
    input: 0,
    output: 0,
    totalTokens: 0,
  };
  assert.deepEqual(normalizeUsage(zero), zero);
  assert.equal(normalizeUsage(undefined), undefined);
  assert.equal(normalizeUsage({ ...zero, totalTokens: -1 }), undefined);
  assert.equal(normalizeUsage({ ...zero, output: Number.NaN }), undefined);
});
