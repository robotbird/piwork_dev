import assert from "node:assert/strict";
import test from "node:test";
import { resolveChatModelId } from "../../../hooks/chat-model";
import { ChatbotError } from "../../../lib/errors";

const catalog = {
  defaultModelId: "installation:a/default",
  models: [{ id: "installation:a/default" }, { id: "installation:b/qwen" }],
};

test("model resolution waits for the authorized catalog", () => {
  assert.equal(resolveChatModelId(undefined, "deepseek/deepseek-flash"), null);
  assert.equal(
    resolveChatModelId({ defaultModelId: null, models: [] }, "old"),
    null
  );
});

test("valid preferences survive and stale IDs resolve to the displayed default", () => {
  assert.equal(
    resolveChatModelId(catalog, "installation:b/qwen"),
    "installation:b/qwen"
  );
  assert.equal(
    resolveChatModelId(catalog, "deepseek/deepseek-flash"),
    catalog.defaultModelId
  );
  assert.equal(
    resolveChatModelId({ ...catalog, defaultModelId: "removed" }, "old"),
    catalog.models[0].id
  );
});

test("model authorization errors do not claim another user's chat", async () => {
  const error = new ChatbotError("forbidden:model", "Model not authorized");
  const response = error.toResponse();
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.code, "forbidden:model");
  assert.match(body.message, /model.*unavailable or not authorized/);
  assert.doesNotMatch(body.message, /another user/);
  assert.match(new ChatbotError("forbidden:chat").message, /another user/);
});
