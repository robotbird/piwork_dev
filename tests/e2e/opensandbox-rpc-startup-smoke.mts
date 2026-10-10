// Explicit RPC startup probe. No prompt/model request; dummy token cannot authorize inference.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fauxAssistantMessage, fauxText } from "@earendil-works/pi-ai";
import { RpcClient } from "@earendil-works/pi-coding-agent";
import { getActiveModelCatalog } from "../../lib/ai/active-models";
import { getPiModel } from "../../lib/ai/pi";
import { getSandboxResourcePolicy } from "../../lib/db/sandbox-settings-queries";
import { seedSessionFile } from "../../lib/runtime/backends/local-rpc/spawn";
import { buildSandboxAgentArgv } from "../../lib/runtime/backends/sandbox-rpc/backend";
import {
  DELIVER_FILE_EXTENSION_PATH,
  deliverFileExtensionSource,
} from "../../lib/runtime/backends/sandbox-rpc/deliver-file-extension";
import {
  buildSandboxModelsJson,
  sandboxModelEntryFromModel,
} from "../../lib/runtime/inference-proxy/models-manifest";
import type { SandboxHandle } from "../../lib/runtime/sandbox";
import { startSandboxBridge } from "../../lib/runtime/sandbox/bridge/pump";
import { buildSandboxProvider } from "../../lib/runtime/sandbox/configuration";

if (process.env.PIWORK_OPENSANDBOX_RPC_TEST !== "1") {
  console.log(
    "Skipped: set PIWORK_OPENSANDBOX_RPC_TEST=1 for a real provider startup probe."
  );
  process.exit(0);
}
assert.equal(process.env.PIWORK_SANDBOX_PROVIDER, "opensandbox");
const catalog = await getActiveModelCatalog();
const modelId =
  catalog.defaultModelId ??
  catalog.models.find((entry) => entry.capabilities.tools)?.id;
assert(modelId, "An enabled model is required");
const model = await getPiModel(modelId);
const provider = buildSandboxProvider("opensandbox");
const resource = await getSandboxResourcePolicy();
let handle: SandboxHandle | undefined;
let bridge: Awaited<ReturnType<typeof startSandboxBridge>> | undefined;
let client: RpcClient | undefined;
const proxyUrl = process.env.PIWORK_INFERENCE_URL;
assert(
  proxyUrl &&
    process.env.PIWORK_SANDBOX_IMAGE &&
    process.env.PIWORK_SANDBOX_CLI_PATH
);
let diagnosticOutput = "";
let seedDir: string | undefined;
try {
  handle = await provider.acquire({
    chatId: crypto.randomUUID(),
    egress: { fqdns: [new URL(proxyUrl).hostname], mode: "allowlist" },
    image: process.env.PIWORK_SANDBOX_IMAGE,
    metadata: { "piwork.activation-probe": "rpc-startup-only" },
    resource,
    runId: crypto.randomUUID(),
    ttlSeconds: 600,
    workspaceVolume: { source: "ephemeral" },
  });
  await handle.writeFile(
    "piwork/agentdir/models.json",
    Buffer.from(
      buildSandboxModelsJson({
        models: [sandboxModelEntryFromModel(model)],
        proxyUrl,
      })
    )
  );
  let args = ["--no-session", "--no-extensions", "--no-skills"];
  if (process.env.PIWORK_RPC_PROBE_EXTENSION === "1") {
    await handle.writeFile(
      DELIVER_FILE_EXTENSION_PATH,
      Buffer.from(deliverFileExtensionSource())
    );
    args = [
      "--session",
      `${handle.workspaceRoot}/piwork/session.jsonl`,
      "--system-prompt",
      "Smoke startup only",
      "--extension",
      `${handle.workspaceRoot}/${DELIVER_FILE_EXTENSION_PATH}`,
    ];
  }
  if (process.env.PIWORK_RPC_PROBE_EXTENSION === "1") {
    const chatId = crypto.randomUUID();
    seedDir = await mkdtemp(path.join(tmpdir(), "piwork-rpc-probe-seed-"));
    const seed = seedSessionFile(
      {
        appendSystemPrompt: [],
        chatId,
        historyMessages: [
          {
            content: "Synthetic startup probe",
            role: "user",
            timestamp: Date.now(),
          },
          fauxAssistantMessage([
            fauxText("Synthetic history; no model was called"),
          ]),
        ],
        model,
        systemPrompt: "Smoke startup only",
        tools: [],
        workspaceDir: handle.workspaceRoot,
      },
      seedDir,
      handle.workspaceRoot
    );
    await handle.writeFile("piwork/session.jsonl", await readFile(seed));
    args.push(
      "--append-system-prompt",
      "",
      "--append-system-prompt",
      "Execution probe startup only"
    );
  }
  const raw = handle;
  const instrumented: SandboxHandle = {
    ...raw,
    id: raw.id,
    startProcess: async (command) => {
      const channel = await raw.startProcess(command);
      return {
        ...channel,
        async *read() {
          for await (const chunk of channel.readCombined?.() ??
            channel.read()) {
            diagnosticOutput += Buffer.from(chunk).toString();
            yield chunk;
          }
        },
      };
    },
    workspaceRoot: raw.workspaceRoot,
  };
  bridge = await startSandboxBridge(instrumented, {
    argv: buildSandboxAgentArgv(
      { args, model: model.id, provider: model.provider },
      process.env.PIWORK_SANDBOX_CLI_PATH
    ),
    cwd: handle.workspaceRoot,
    env: {
      PI_CODING_AGENT_DIR: `${handle.workspaceRoot}/piwork/agentdir`,
      PI_OFFLINE: "1",
      PIWORK_RUN_TOKEN: "invalid-probe-token",
    },
  });
  client = new RpcClient({
    args: [],
    cliPath: bridge.shimPath,
    env: bridge.shimEnv,
  });
  await client.start();
  const state = await client.getState();
  console.log("PASS: official RpcClient getState", { model: state.model?.id });
} catch (error) {
  console.error(
    "RPC startup output (dummy token, no prompt):",
    diagnosticOutput.slice(-6000)
  );
  throw error;
} finally {
  if (seedDir) {
    await rm(seedDir, { force: true, recursive: true });
  }
  await client?.stop();
  await bridge?.stop();
  if (handle) {
    await provider.release(handle, "kill");
    assert.equal(await provider.control?.inspect(handle.id), null);
    console.log("PASS: diagnostic sandbox deletion confirmed");
  }
}
// Plugin workers retain event-loop handles; exit only AFTER successful provider cleanup.
process.exit(0);
