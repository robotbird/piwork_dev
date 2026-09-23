/**
 * 插件 worker 运行时（WorkerThreadPluginHost 的隔离执行侧）。
 *
 * 纯 ESM JavaScript，不经 Next.js 打包，仅通过 parentPort RPC 通信：
 *  - activate: 动态加载 artifact bundle，以受限 PiworkLlmExtensionAPI
 *    运行插件 factory，并校验 registerProvider 契约（恰好一次、id 一致）。
 *  - invoke: 在 worker 内调用 provider.streamSimple 并逐事件回传。
 *  - validate-credentials: 调用插件导出的 validateCredentials。
 *
 * 协议见 lib/model-plugins/host/protocol.ts。
 */
import { parentPort } from "node:worker_threads";

/** @type {any} */
let module_ = null;
/** @type {any} */
let provider = null;
/** @type {Array<() => any>} */
let disposeHandlers = [];
const invokeControllers = new Map();

const EMPTY_AUTH_CONTEXT = {
  env: async () => undefined,
  fileExists: async () => false,
};

function post(message) {
  parentPort?.postMessage(message);
}

function makeLogger() {
  const send = (level, message, data) =>
    post({ data, level, message, type: "log" });
  return {
    error: (message, data) => send("error", message, data),
    info: (message, data) => send("info", message, data),
    warn: (message, data) => send("warn", message, data),
  };
}

function assertProviderContract(candidate, runtimeProviderId) {
  if (!candidate || typeof candidate !== "object") {
    throw new Error("registerProvider() must receive a Provider object");
  }
  if (candidate.id !== runtimeProviderId) {
    throw new Error(
      `Registered provider id "${candidate.id}" must equal runtime provider id "${runtimeProviderId}"`
    );
  }
  if (typeof candidate.getModels !== "function") {
    throw new Error("Registered provider must implement getModels()");
  }
  if (
    typeof candidate.streamSimple !== "function" ||
    typeof candidate.stream !== "function"
  ) {
    throw new Error("Registered provider must implement stream/streamSimple");
  }
  const models = candidate.getModels();
  if (!Array.isArray(models) || models.length === 0) {
    throw new Error("Registered provider returned no models");
  }
  for (const model of models) {
    if (model.provider !== runtimeProviderId) {
      throw new Error(
        `Provider model "${model.id}" has provider "${model.provider}", expected "${runtimeProviderId}"`
      );
    }
  }
}

async function handleActivate(message) {
  const { artifactEntry, requestId } = message;
  module_ = await import(artifactEntry);

  if (!module_ || typeof module_.definition !== "object") {
    throw new Error("Plugin must export a `definition` object");
  }
  if (typeof module_.default !== "function") {
    throw new Error("Plugin must default-export an activate factory");
  }

  const { context, runtimeProviderId } = message;
  let registrations = 0;
  const assertRegistered = () => {
    if (registrations === 0) {
      throw new Error(
        "Plugin activate() must call registerProvider() exactly once"
      );
    }
  };
  const api = {
    context,
    onDispose(handler) {
      disposeHandlers.push(handler);
    },
    registerProvider(candidate) {
      if (registrations > 0) {
        throw new Error("registerProvider() must be called exactly once");
      }
      registrations += 1;
      assertProviderContract(candidate, runtimeProviderId);
      provider = candidate;
    },
  };

  try {
    await module_.default(api);
  } catch (error) {
    // factory 抛错时仍需区分"从未注册"与"注册后失败"
    assertRegistered();
    throw error;
  }
  assertRegistered();

  post({
    definition: module_.definition,
    provider: {
      baseUrl: provider.baseUrl,
      id: provider.id,
      models: provider.getModels(),
      name: provider.name,
    },
    requestId,
    type: "activated",
  });
}

async function loadModule(artifactEntry) {
  if (!module_) {
    module_ = await import(artifactEntry);
  }
  if (!module_ || typeof module_.definition !== "object") {
    throw new Error("Plugin must export a `definition` object");
  }
  return module_;
}

async function handleInspect(message) {
  const loaded = await loadModule(message.artifactEntry);
  post({
    definition: loaded.definition,
    requestId: message.requestId,
    type: "inspected",
  });
}

async function handleValidateCredentials(message) {
  const { artifactEntry, config, credentials, requestId } = message;
  await loadModule(artifactEntry);
  if (!module_ || typeof module_.validateCredentials !== "function") {
    throw new Error("Plugin does not export validateCredentials()");
  }
  await module_.validateCredentials({
    config,
    credentials,
    fetch: globalThis.fetch,
    logger: makeLogger(),
  });
  post({ requestId, type: "validate-result" });
}

/** 与 Models.applyAuth 等价的最小实现：worker 侧 provider 自带鉴权 */
async function applyProviderAuth(model, options) {
  let resolution;
  try {
    const apiKeyAuth = provider?.auth?.apiKey;
    resolution = apiKeyAuth
      ? await apiKeyAuth.resolve({
          credential: undefined,
          ctx: EMPTY_AUTH_CONTEXT,
        })
      : undefined;
  } catch {
    resolution = undefined;
  }
  const apiKey = options.apiKey ?? resolution?.auth?.apiKey;
  const baseUrl = resolution?.auth?.baseUrl;
  const headers = {
    ...(resolution?.auth?.headers ?? {}),
    ...(options.headers ?? {}),
  };
  return {
    model: baseUrl ? { ...model, baseUrl } : model,
    options: { ...options, apiKey, headers },
  };
}

async function handleInvoke(message) {
  const { context, model, options, requestId } = message;
  if (!provider) {
    throw new Error("Provider is not activated");
  }
  const controller = new AbortController();
  invokeControllers.set(requestId, controller);
  const prepared = await applyProviderAuth(model, options ?? {});
  const stream = provider.streamSimple(prepared.model, context, {
    ...prepared.options,
    signal: controller.signal,
  });
  try {
    for await (const event of stream) {
      post({ event, requestId, type: "event" });
    }
  } finally {
    invokeControllers.delete(requestId);
  }
  post({ requestId, type: "invoke-end" });
}

async function handleDispose() {
  for (const handler of disposeHandlers) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: dispose handler 需逐个串行执行
      await handler();
    } catch (error) {
      post({
        level: "warn",
        message: `dispose handler failed: ${error instanceof Error ? error.message : String(error)}`,
        type: "log",
      });
    }
  }
  disposeHandlers = [];
  provider = null;
  module_ = null;
  post({ type: "disposed" });
}

parentPort?.on("message", (message) => {
  let run;
  switch (message.type) {
    case "inspect":
      run = handleInspect(message);
      break;
    case "activate":
      run = handleActivate(message);
      break;
    case "validate-credentials":
      run = handleValidateCredentials(message);
      break;
    case "invoke":
      run = handleInvoke(message);
      break;
    case "invoke-abort":
      invokeControllers.get(message.requestId)?.abort();
      return;
    case "dispose":
      run = handleDispose();
      break;
    default:
      return;
  }
  run.catch((error) => {
    const payload = {
      message: error instanceof Error ? error.message : String(error),
      type:
        message.type === "invoke" ? "invoke-error" : `${message.type}-error`,
    };
    if (message.requestId !== undefined) {
      payload.requestId = message.requestId;
    }
    post(payload);
  });
});
