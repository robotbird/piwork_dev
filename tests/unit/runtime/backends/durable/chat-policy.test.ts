import "../../../../support/runtime-env";
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  assertDurableChatUser,
  isDurableChatUserAllowed,
  readDurableChatConfig,
} from "../../../../../lib/runtime/backends/durable/chat-policy";

const userId = crypto.randomUUID();
const env = {
  NODE_ENV: "test",
  PIWORK_DURABLE_CHAT_ENABLED: "1",
  PIWORK_DURABLE_CHAT_USER_IDS: userId,
  PIWORK_DURABLE_STORAGE_DIR: path.resolve(".private-durable-test"),
  PIWORK_SANDBOX_PROVIDER: "opensandbox",
  UPLOAD_DIR: path.resolve(".private-upload-test"),
};
test("Durable chat remains opt-in, test-whitelisted and nonproduction only", () => {
  assert.equal(readDurableChatConfig({}), null);
  const config = readDurableChatConfig(env);
  assert.ok(config);
  assert.equal(config.provider, "opensandbox");
  assertDurableChatUser(config, userId);
  assertDurableChatUser(
    readDurableChatConfig({
      ...env,
      PIWORK_DURABLE_CHAT_USER_IDS: userId.toUpperCase(),
    }),
    userId
  );
  assert.throws(
    () => assertDurableChatUser(config, crypto.randomUUID()),
    /not-authorized/
  );
  assert.throws(
    () => readDurableChatConfig({ ...env, NODE_ENV: "production" }),
    /non-production-only/
  );
  assert.throws(
    () => readDurableChatConfig({ ...env, NODE_ENV: undefined }),
    /non-production-only/
  );
  for (const patch of [
    { PIWORK_DURABLE_CHAT_USER_IDS: "*" },
    { PIWORK_DURABLE_CHAT_USER_IDS: "" },
    { PIWORK_DURABLE_STORAGE_DIR: "relative" },
    { UPLOAD_DIR: "relative" },
    { PIWORK_SANDBOX_PROVIDER: "test" },
    { PIWORK_RUNTIME_BACKEND: "durable" },
    { PIWORK_DISABLE_EXECUTION_TOOLS: "1" },
  ]) {
    assert.throws(
      () => readDurableChatConfig({ ...env, ...patch }),
      /invalid-config/
    );
  }
});
test("development admits UUIDs without a whitelist, never bypassing enabled-member DB checks", () => {
  const config = readDurableChatConfig({
    ...env,
    NODE_ENV: "development",
    PIWORK_DURABLE_CHAT_USER_IDS: undefined,
  });
  assert.ok(config);
  assert.equal(config.users, null);
  assertDurableChatUser(config, userId);
  assertDurableChatUser(config, crypto.randomUUID());
  assertDurableChatUser(config, userId.toUpperCase());
  for (const id of ["", "*", "guest", "user@example.com"]) {
    assert.equal(isDurableChatUserAllowed(config, id), false);
    assert.throws(() => assertDurableChatUser(config, id), /not-authorized/);
  }
  assert.equal(isDurableChatUserAllowed(null, userId), false);
  assert.equal(
    readDurableChatConfig({
      ...env,
      NODE_ENV: "development",
      PIWORK_DURABLE_CHAT_ENABLED: undefined,
    }),
    null
  );
  // A legacy UUID whitelist must not exclude other development members.
  assertDurableChatUser(
    readDurableChatConfig({ ...env, NODE_ENV: "development" }),
    crypto.randomUUID()
  );
});
test("development retains production, private-root and execution configuration gates", () => {
  for (const patch of [
    { NODE_ENV: "production" },
    { NODE_ENV: undefined },
    { PIWORK_DURABLE_STORAGE_DIR: "relative" },
    { UPLOAD_DIR: "relative" },
    { PIWORK_SANDBOX_PROVIDER: "test" },
    { PIWORK_RUNTIME_BACKEND: "durable" },
    { PIWORK_DISABLE_EXECUTION_TOOLS: "1" },
  ]) {
    assert.throws(() =>
      readDurableChatConfig({ ...env, NODE_ENV: "development", ...patch })
    );
  }
});
test("Durable chat rejects overlapping private roots and host chat workspace", () => {
  for (const patch of [
    { UPLOAD_DIR: env.PIWORK_DURABLE_STORAGE_DIR },
    { UPLOAD_DIR: path.join(env.PIWORK_DURABLE_STORAGE_DIR, "files") },
    { PIWORK_DURABLE_STORAGE_DIR: path.resolve(".pi/workspace/sqlite") },
  ]) {
    assert.throws(
      () => readDurableChatConfig({ ...env, ...patch }),
      /roots-overlap/
    );
  }
});
