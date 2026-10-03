import "../../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import type { Api, Model } from "@earendil-works/pi-ai";
import {
  buildSandboxModelsJson,
  RUN_TOKEN_ENV,
  type SandboxModelEntry,
  sandboxModelEntryFromModel,
} from "@/lib/runtime/inference-proxy/models-manifest";

/**
 * 沙箱 agentDir models.json 生成专测（spec §6 Phase 4）：官方
 * ProviderConfigSchema 形状（api: "pi-messages" + `${ENV}` 模板 apiKey +
 * baseUrl）、按 provider 分组、真实凭据永不入沙箱。
 */

const DEEPSEEK_FLASH: SandboxModelEntry = {
  contextWindow: 128_000,
  id: "deepseek-flash",
  input: ["text"],
  maxTokens: 8192,
  name: "DeepSeek Flash",
  provider: "deepseek",
  reasoning: true,
};

function modelOf(entry: SandboxModelEntry): Model<Api> {
  return {
    api: "faux" as Api,
    baseUrl: "http://upstream.invalid",
    contextWindow: entry.contextWindow,
    id: entry.id,
    maxTokens: entry.maxTokens,
    name: entry.name,
    provider: entry.provider,
    reasoning: entry.reasoning,
    ...(entry.input ? { input: [...entry.input] } : {}),
    ...(entry.cost ? { cost: entry.cost } : {}),
  } as Model<Api>;
}

test("单模型：官方 pi-messages provider 形状 + env 模板 apiKey", () => {
  const json = buildSandboxModelsJson({
    models: [DEEPSEEK_FLASH],
    proxyUrl: "http://host.docker.internal:3210",
  });
  assert.ok(json.endsWith("\n"), "落盘文件以换行收尾");
  const parsed = JSON.parse(json) as {
    providers: Record<
      string,
      {
        api: string;
        apiKey: string;
        baseUrl: string;
        models: Record<string, unknown>[];
        name: string;
      }
    >;
  };
  assert.deepEqual(Object.keys(parsed.providers), ["deepseek"]);
  const provider = parsed.providers.deepseek;
  assert.equal(provider.api, "pi-messages");
  // biome-ignore lint/suspicious/noTemplateCurlyInString: 断言官方 env 模板字面量（非 JS 插值）
  assert.equal(provider.apiKey, "${PIWORK_RUN_TOKEN}");
  assert.equal(provider.baseUrl, "http://host.docker.internal:3210");
  assert.equal(provider.name, "Piwork Inference Proxy (deepseek)");
  assert.deepEqual(provider.models, [
    {
      contextWindow: 128_000,
      id: "deepseek-flash",
      input: ["text"],
      maxTokens: 8192,
      name: "DeepSeek Flash",
      reasoning: true,
    },
  ]);
});

test("同 provider 多模型聚合；跨 provider 分条目", () => {
  const json = buildSandboxModelsJson({
    models: [
      DEEPSEEK_FLASH,
      { ...DEEPSEEK_FLASH, id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
      { ...DEEPSEEK_FLASH, id: "qwen-max", name: "Qwen Max", provider: "qwen" },
    ],
    proxyUrl: "http://127.0.0.1:3210",
  });
  const parsed = JSON.parse(json) as {
    providers: Record<string, { models: { id: string }[] }>;
  };
  assert.deepEqual(
    Object.keys(parsed.providers).sort((a, b) => a.localeCompare(b)),
    ["deepseek", "qwen"]
  );
  assert.deepEqual(
    parsed.providers.deepseek.models
      .map((m) => m.id)
      .sort((a, b) => a.localeCompare(b)),
    ["deepseek-flash", "deepseek-v4-pro"]
  );
  assert.deepEqual(
    parsed.providers.qwen.models.map((m) => m.id),
    ["qwen-max"]
  );
});

test("tokenEnvVar 可定制（模板与 RUN_TOKEN_ENV 常量一致）", () => {
  assert.equal(RUN_TOKEN_ENV, "PIWORK_RUN_TOKEN");
  const json = buildSandboxModelsJson({
    models: [DEEPSEEK_FLASH],
    proxyUrl: "http://p",
    tokenEnvVar: "ALT_TOKEN",
  });
  const parsed = JSON.parse(json) as {
    providers: { deepseek: { apiKey: string } };
  };
  // biome-ignore lint/suspicious/noTemplateCurlyInString: 断言官方 env 模板字面量（非 JS 插值）
  assert.equal(parsed.providers.deepseek.apiKey, "${ALT_TOKEN}");
});

test("空模型清单拒绝生成（run 必须带模型）", () => {
  assert.throws(
    () => buildSandboxModelsJson({ models: [], proxyUrl: "http://p" }),
    /inference-proxy:models-json:empty/
  );
});

test("sandboxModelEntryFromModel：Model 对象收敛为 models.json 条目", () => {
  assert.deepEqual(
    sandboxModelEntryFromModel(modelOf(DEEPSEEK_FLASH)),
    DEEPSEEK_FLASH
  );
  // 可缺省字段补默认：reasoning → false、input → ["text"]、cost 省略
  const minimal = {
    api: "faux" as Api,
    baseUrl: "http://u",
    contextWindow: 1000,
    id: "m1",
    maxTokens: 100,
    name: "M1",
    provider: "p1",
  } as Model<Api>;
  const entry = sandboxModelEntryFromModel(minimal);
  assert.equal(entry.reasoning, false);
  assert.deepEqual(entry.input, ["text"]);
  assert.ok(!("cost" in entry));
  // cost 存在时原样携带
  const withCost = sandboxModelEntryFromModel({
    ...minimal,
    cost: {
      cacheRead: 0,
      cacheWrite: 0,
      input: 1,
      output: 2,
    },
  } as Model<Api>);
  assert.deepEqual(withCost.cost, {
    cacheRead: 0,
    cacheWrite: 0,
    input: 1,
    output: 2,
  });
});
