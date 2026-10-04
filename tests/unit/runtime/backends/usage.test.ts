import "../../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { PiEventNormalizer } from "../../../../lib/runtime/backends/pi-event-normalizer";
import { normalizeUsage } from "../../../../lib/runtime/backends/usage";

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
  const normalizer = new PiEventNormalizer();
  normalizer.feed({ message, type: "message_start" });
  const [event] = normalizer.feed({ message, type: "message_end" });
  assert.equal(event.type, "message.completed");
  if (event.type === "message.completed") {
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
