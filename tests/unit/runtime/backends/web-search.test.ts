// biome-ignore-all lint/suspicious/useAwait: Async test doubles implement RuntimeBackend.open.
import "../../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import { getPiModel } from "../../../../lib/ai/pi";
import { createWebSearchTool } from "../../../../lib/ai/web-tools";
import { LocalRpcBackend } from "../../../../lib/runtime/backends/local-rpc/backend";
import {
  RoutingRuntimeBackend,
  requiresSandbox,
} from "../../../../lib/runtime/backends/routing/backend";
import { SandboxRpcBackend } from "../../../../lib/runtime/backends/sandbox-rpc/backend";
import type { RuntimeSpec } from "../../../../lib/runtime/protocol";
import { TestSandboxProvider } from "../../../support/sandbox/test-sandbox-provider";

test("matrix routes platform search without workspace to lightweight; RPC rejects unsupported search before launch", async () => {
  const spec: RuntimeSpec = {
    appendSystemPrompt: [],
    chatId: crypto.randomUUID(),
    historyMessages: [],
    model: await getPiModel("deepseek/deepseek-flash"),
    systemPrompt: "test",
    tools: [
      createWebSearchTool(async () => ({ provider: "tavily", results: [] })),
    ],
    workspaceDir: null,
  };
  assert.equal(requiresSandbox(spec), false);
  let selected = "";
  const router = new RoutingRuntimeBackend({
    inProcess: {
      open: async () => {
        selected = "lightweight";
        throw new Error("marker");
      },
    },
    sandbox: {
      open: async () => {
        selected = "sandbox";
        throw new Error("marker");
      },
    },
  });
  await assert.rejects(router.open(spec), /marker/);
  assert.equal(selected, "lightweight");
  await assert.rejects(
    router.open({ ...spec, workspaceDir: "/workspace" }),
    /marker/
  );
  assert.equal(selected, "sandbox");
  await assert.rejects(new LocalRpcBackend().open(spec), /尚未接入 LocalRpc/);
  const sandbox = new SandboxRpcBackend({
    provider: new TestSandboxProvider(),
    remoteCliPath: "/opt/pi/cli.js",
  });
  await assert.rejects(sandbox.open(spec), /尚未接入 SandboxRpc/);
});
