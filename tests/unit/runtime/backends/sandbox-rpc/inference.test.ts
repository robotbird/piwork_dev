import "../../../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import type { Api, Model } from "@earendil-works/pi-ai";
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
} from "@earendil-works/pi-ai";
import { getPiModel } from "@/lib/ai/pi";
import { resolveDefaultCliPath } from "@/lib/runtime/backends/local-rpc/spawn";
import {
  deriveSandboxEgress,
  type SandboxInferenceOptions,
  SandboxRpcBackend,
} from "@/lib/runtime/backends/sandbox-rpc/backend";
import {
  type InferenceAuditEntry,
  InferenceProxyServer,
  RunTokenRegistry,
} from "@/lib/runtime/inference-proxy";
import type {
  RuntimeEvent,
  RuntimeSession,
  RuntimeSpec,
} from "@/lib/runtime/protocol";
import { TestSandboxProvider } from "../../../../support/sandbox/test-sandbox-provider";

/**
 * SandboxRpcBackend × Inference Proxy 装配专测（spec §6 Phase 4，v2.0 §7.2）：
 * egress 只能收紧的派生、models.json 落 agentDir、run token 签发/撤销闭环、
 * 以及全链路回环——沙箱内官方 pi 经 models.json（pi-messages provider +
 * `${PIWORK_RUN_TOKEN}`）访问控制面代理，真实凭据全程不出控制面。
 */

const TEST_TIMEOUT_MS = 60_000;
const TEST_MODEL_ID = "deepseek/deepseek-flash";
const CHAT_ID = "00000000-0000-0000-0000-0000000000c1";

/** 记录 startProcess env 的 provider（在替身句柄上包一层，不改替身本体） */
function envRecordingProvider(): {
  provider: TestSandboxProvider;
  processEnvs: Record<string, string>[];
} {
  const provider = new TestSandboxProvider();
  const processEnvs: Record<string, string>[] = [];
  const originalAcquire = provider.acquire.bind(provider);
  provider.acquire = async (spec) => {
    const handle = await originalAcquire(spec);
    const originalStart = handle.startProcess.bind(handle);
    handle.startProcess = (command) => {
      processEnvs.push(command.env ?? {});
      return originalStart(command);
    };
    return handle;
  };
  return { processEnvs, provider };
}

let cachedModel: RuntimeSpec["model"] | undefined;

async function makeSpec(): Promise<RuntimeSpec> {
  cachedModel ??= await getPiModel(TEST_MODEL_ID);
  return {
    appendSystemPrompt: [],
    chatId: CHAT_ID,
    historyMessages: [],
    model: cachedModel,
    systemPrompt: "piwork inference proxy test",
    tools: [],
    workspaceDir: null,
  };
}

async function collect(session: RuntimeSession): Promise<RuntimeEvent[]> {
  const events: RuntimeEvent[] = [];
  for await (const event of session.events()) {
    events.push(event);
    if (event.type === "run.settled" || event.type === "run.failed") {
      break;
    }
  }
  return events;
}

// ---------------------------------------------------------------- egress 派生

test("deriveSandboxEgress：无 inference = deny-all；有 = proxy 恒在的 allowlist", () => {
  assert.deepEqual(deriveSandboxEgress(undefined, undefined), {
    mode: "deny-all",
  });
  assert.deepEqual(
    deriveSandboxEgress(undefined, { allowFqdns: ["a.example"] }),
    {
      mode: "deny-all",
    }
  );

  const inference: SandboxInferenceOptions = {
    mintRunToken: () => "t",
    proxyUrl: "http://proxy.internal:3210",
    revokeRunTokens: () => undefined,
  };
  // 无申请：基线即白名单
  assert.deepEqual(deriveSandboxEgress(inference, undefined), {
    fqdns: ["proxy.internal"],
    mode: "allowlist",
  });
  // 装配级附加基线
  const withBaseline: SandboxInferenceOptions = {
    ...inference,
    baselineFqdns: ["mirror.example", "proxy.internal"],
  };
  assert.deepEqual(deriveSandboxEgress(withBaseline, undefined), {
    fqdns: ["proxy.internal", "mirror.example"],
    mode: "allowlist",
  });
  // 申请与基线取交集（只能收紧）：超出基线的申请被丢弃、不重复、保序
  assert.deepEqual(
    deriveSandboxEgress(withBaseline, {
      allowFqdns: [
        "evil.example",
        "mirror.example",
        "mirror.example",
        "proxy.internal",
      ],
    }),
    { fqdns: ["proxy.internal", "mirror.example"], mode: "allowlist" }
  );
  // 申请完全在基线外 → 只剩 proxy 主机
  assert.deepEqual(
    deriveSandboxEgress(withBaseline, { allowFqdns: ["evil.example"] }),
    { fqdns: ["proxy.internal"], mode: "allowlist" }
  );
  // 非法 proxyUrl 直接抛（fail-closed，不猜）
  assert.throws(
    () =>
      deriveSandboxEgress({ ...inference, proxyUrl: "not a url" }, undefined),
    /runtime:sandbox:bad-config:inference.proxyUrl/
  );
});

// ------------------------------------------------------------ fail-closed 闭环

test("mint 失败：run 直接失败，不创建任何沙箱（token 先于沙箱）", async () => {
  const provider = new TestSandboxProvider();
  const backend = new SandboxRpcBackend({
    inference: {
      mintRunToken: () => {
        throw new Error("mint-exploded");
      },
      proxyUrl: "http://127.0.0.1:1",
      revokeRunTokens: () => undefined,
    },
    provider,
    remoteCliPath: resolveDefaultCliPath(),
  });
  await assert.rejects(backend.open(await makeSpec()), /mint-exploded/);
  assert.equal(provider.acquiredSpecs.length, 0);
});

test("acquire 失败：已签发 token 必须撤销（同一 runId）", async () => {
  const provider = new TestSandboxProvider();
  provider.failNextAcquires(1);
  const minted: string[] = [];
  const revoked: string[] = [];
  const backend = new SandboxRpcBackend({
    inference: {
      mintRunToken: (request) => {
        minted.push(request.runId);
        return "token-1";
      },
      proxyUrl: "http://127.0.0.1:1",
      revokeRunTokens: (runId) => {
        revoked.push(runId);
      },
    },
    provider,
    remoteCliPath: resolveDefaultCliPath(),
  });
  await assert.rejects(backend.open(await makeSpec()));
  assert.equal(minted.length, 1);
  assert.deepEqual(revoked, minted);
});

// -------------------------------------------------- 全链路：沙箱 pi → 代理 → faux

test("全链路：models.json + run token env + egress + 撤销闭环 + 代理回环出文本", {
  timeout: TEST_TIMEOUT_MS,
}, async () => {
  // 控制面：真 HTTP 代理 + faux 上游（官方测试替身；真实凭据只在控制面）
  const faux = fauxProvider({
    models: [{ id: "deepseek-flash", name: "DeepSeek Flash" }],
    provider: "deepseek",
    tokensPerSecond: 0,
  });
  faux.setResponses([fauxAssistantMessage([fauxText("经代理的回答")])]);
  const tokens = new RunTokenRegistry();
  const audit: InferenceAuditEntry[] = [];
  const server = new InferenceProxyServer({
    audit: {
      record: (entry) => {
        audit.push(entry);
      },
    },
    resolver: () => ({
      model: faux.getModel("deepseek-flash") as Model<Api>,
      provider: faux.provider,
    }),
    tokens,
  });
  const { url: proxyUrl } = await server.listen();
  const mintRequests: {
    chatId: string;
    grants: readonly { model: string; provider: string }[];
    runId: string;
  }[] = [];
  const revoked: string[] = [];
  const inference: SandboxInferenceOptions = {
    mintRunToken: (request) => {
      mintRequests.push(request);
      return tokens.mint(request).token;
    },
    proxyUrl,
    revokeRunTokens: (runId) => {
      revoked.push(runId);
      tokens.revokeRun(runId);
    },
  };

  const { processEnvs, provider } = envRecordingProvider();
  const backend = new SandboxRpcBackend({
    inference,
    provider,
    remoteCliPath: resolveDefaultCliPath(),
  });
  const session = await backend.open(await makeSpec());
  try {
    // 装配断言：token 按 spec.model 签发；egress/metadata 进 SandboxSpec
    assert.equal(mintRequests.length, 1);
    assert.equal(mintRequests[0].chatId, CHAT_ID);
    assert.deepEqual(mintRequests[0].grants, [
      { model: "deepseek-flash", provider: "deepseek" },
    ]);
    const [spec] = provider.acquiredSpecs;
    assert.ok(spec);
    assert.deepEqual(spec.egress, { fqdns: ["127.0.0.1"], mode: "allowlist" });
    assert.equal(spec.metadata?.["piwork.io/run-id"], mintRequests[0].runId);

    // models.json 落 agentDir：官方 pi-messages provider + env 模板凭据
    const handle = provider.sandbox("test-sbx-1")?.handle;
    assert.ok(handle);
    const modelsJson = JSON.parse(
      Buffer.from(
        await handle.readFile("piwork/agentdir/models.json")
      ).toString("utf8")
    ) as {
      providers: {
        deepseek: {
          api: string;
          apiKey: string;
          baseUrl: string;
          models: { id: string }[];
        };
      };
    };
    assert.equal(modelsJson.providers.deepseek.api, "pi-messages");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: 断言官方 env 模板字面量（非 JS 插值）
    assert.equal(modelsJson.providers.deepseek.apiKey, "${PIWORK_RUN_TOKEN}");
    assert.equal(modelsJson.providers.deepseek.baseUrl, proxyUrl);
    assert.deepEqual(
      modelsJson.providers.deepseek.models.map((m) => m.id),
      ["deepseek-flash"]
    );

    // 沙箱进程 env：run token 是唯一模型凭据，agentDir 指向 workspace
    assert.ok(processEnvs.length >= 1, "bridge 应已启动沙箱进程");
    const [sandboxEnv] = processEnvs;
    assert.match(sandboxEnv.PIWORK_RUN_TOKEN ?? "", /^[0-9a-f]{64}$/);
    assert.equal(
      sandboxEnv.PI_CODING_AGENT_DIR,
      `${handle.workspaceRoot}/piwork/agentdir`
    );

    // 回环：沙箱内官方 pi → pi-messages 客户端 → 代理 → faux 上游
    await session.send({ text: "你好", type: "prompt" });
    const events = await collect(session);
    assert.equal(events.at(-1)?.type, "run.settled");
    const text = events
      .filter(
        (event): event is Extract<RuntimeEvent, { type: "message.delta" }> =>
          event.type === "message.delta" &&
          event.channel === "text" &&
          event.phase === "delta"
      )
      .map((event) => event.delta ?? "")
      .join("");
    assert.equal(text, "经代理的回答");

    // 代理侧审计：一次 allowed 流式访问，脱敏（无 token 材料）
    assert.equal(audit.filter((entry) => entry.status === "allowed").length, 1);
    const allowed = audit.find((entry) => entry.status === "allowed");
    assert.equal(allowed?.provider, "deepseek");
    assert.equal(allowed?.model, "deepseek-flash");
    assert.equal(allowed?.runId, mintRequests[0].runId);
  } finally {
    await session.close("test-done");
  }
  // close 后：token 撤销（幂等一次）、注册表清空
  assert.deepEqual(
    revoked,
    mintRequests.map((request) => request.runId)
  );
  assert.equal(tokens.size, 0);
  await server.close();
});
