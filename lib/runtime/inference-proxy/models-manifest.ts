import "server-only";

import type { Api, Model } from "@earendil-works/pi-ai";

/**
 * 沙箱 agentDir `models.json` 生成（spec §6 Phase 4，v2.0 §7.2）。
 *
 * 沙箱内 pi 只见 Inference Proxy 一个模型入口：每个 run 按 RuntimeSpec
 * 生成 provider 条目（官方 `pi-messages` wire 协议），凭据走官方
 * `${ENV_VAR}` 模板解析到进程 env（pi-coding-agent
 * `resolve-config-value.js` / `provider-composer.js composeApiKeyAuth`），
 * 真实 provider credential 永不进沙箱——env 里只有短期 run token。
 *
 * 依据（已装 1.0.0 源码核对）：`core/model-config.js`
 * `ProviderConfigSchema`/`ModelDefinitionSchema`（字段与校验），
 * `core/provider-composer.js` `modelFromJson`（api 继承 provider 级、
 * baseUrl 必填、provider key 即 Model.provider、模型引用
 * `<provider>/<id>`）。`apiKey` 缺省会怎样：pi-messages 客户端要求
 * apiKey（`No API key provided`），composeApiKeyAuth.check() 在 env 缺失
 * 时也会 fail-fast——这是官方 fail-closed 通道，不是我们自造的校验。
 */

/** 沙箱内承载 run token 的 env 变量名（与 models.json 模板一致） */
export const RUN_TOKEN_ENV = "PIWORK_RUN_TOKEN";

/** models.json 模型条目（ModelDefinitionSchema 的合法子集） */
export type SandboxModelEntry = {
  provider: string;
  id: string;
  name: string;
  contextWindow: number;
  maxTokens: number;
  reasoning: boolean;
  input: readonly ("text" | "image")[];
  cost?: Model<Api>["cost"];
};

/** RuntimeSpec.model（pi Model 对象）→ models.json 模型条目 */
export function sandboxModelEntryFromModel(
  model: Model<Api>
): SandboxModelEntry {
  return {
    contextWindow: model.contextWindow,
    id: model.id,
    input: [...(model.input ?? ["text"])],
    maxTokens: model.maxTokens,
    name: model.name,
    provider: model.provider,
    reasoning: model.reasoning ?? false,
    ...(model.cost ? { cost: model.cost } : {}),
  };
}

export function buildSandboxModelsJson(options: {
  /** 沙箱视角可达的 proxy 地址（如 http://host.docker.internal:3210） */
  proxyUrl: string;
  models: readonly SandboxModelEntry[];
  tokenEnvVar?: string;
}): string {
  const tokenEnvVar = options.tokenEnvVar ?? RUN_TOKEN_ENV;
  if (options.models.length === 0) {
    throw new Error("inference-proxy:models-json:empty（run 未携带任何模型）");
  }
  const byProvider = new Map<string, SandboxModelEntry[]>();
  for (const entry of options.models) {
    const list = byProvider.get(entry.provider) ?? [];
    list.push(entry);
    byProvider.set(entry.provider, list);
  }
  const providers: Record<string, unknown> = {};
  for (const [providerId, models] of byProvider) {
    providers[providerId] = {
      api: "pi-messages",
      // 官方 env 模板：pi 启动时从沙箱进程 env 解析 run token
      apiKey: `\${${tokenEnvVar}}`,
      baseUrl: options.proxyUrl,
      models: models.map((model) => ({
        contextWindow: model.contextWindow,
        id: model.id,
        input: [...model.input],
        maxTokens: model.maxTokens,
        name: model.name,
        reasoning: model.reasoning,
        ...(model.cost ? { cost: model.cost } : {}),
      })),
      name: `Piwork Inference Proxy (${providerId})`,
    };
  }
  return `${JSON.stringify({ providers }, null, 2)}\n`;
}
