import { join } from "node:path";
import { Worker } from "node:worker_threads";

import type {
  Api,
  ApiStreamOptions,
  AssistantMessage,
  AssistantMessageEvent,
  Context,
  Model,
  Provider,
  ProviderAuth,
  SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type {
  ProviderDefinition,
  ProviderFactoryContext,
} from "@piwork/model-provider-sdk";

/**
 * WorkerThreadPluginHost：开发 / 受信任内置插件用的工作线程隔离宿主
 * （架构 §6.2）。工作线程提供故障与生命周期隔离；生产环境的用户上传
 * 包应改用 RemotePluginHost（独立进程/容器），两者满足同一 interface。
 *
 * worker 侧运行时见同目录 worker-runtime.mjs（纯 ESM JS，不经打包）。
 */

type HostRequest =
  | {
      type: "inspect";
      requestId: number;
      artifactEntry: string;
    }
  | {
      type: "activate";
      requestId: number;
      artifactEntry: string;
      runtimeProviderId: string;
      context: Omit<ProviderFactoryContext, "fetch" | "logger">;
    }
  | {
      type: "validate-credentials";
      requestId: number;
      artifactEntry: string;
      credentials: Record<string, unknown>;
      config: Record<string, unknown>;
    }
  | {
      type: "invoke";
      requestId: number;
      model: Model<Api>;
      context: Context;
      options: Record<string, unknown>;
    }
  | { type: "invoke-abort"; requestId: number }
  | { type: "dispose" };

export type ActivationSnapshot = {
  definition: ProviderDefinition;
  provider: {
    baseUrl?: string;
    id: string;
    models: Model<Api>[];
    name: string;
  };
};

export type ActivateProviderRequest = {
  artifactEntry: string;
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
  installationId: string;
  providerId: string;
  runtimeProviderId: string;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

class InvokeRelay {
  private readonly send: (message: HostRequest) => void;
  private readonly requestId: number;

  constructor(send: (message: HostRequest) => void, requestId: number) {
    this.send = send;
    this.requestId = requestId;
  }

  abort(): void {
    this.send({ requestId: this.requestId, type: "invoke-abort" });
  }
}

export class WorkerThreadPluginHost {
  private worker: Worker | null = null;
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly invokes = new Map<
    number,
    {
      onEvent: (event: AssistantMessageEvent) => void;
      onError: (message: string) => void;
      onEnd: () => void;
    }
  >();
  /** 安装实例凭据中的 secret 值，用于日志脱敏 */
  private secretValues: string[] = [];

  private ensureWorker(): Worker {
    if (this.worker) {
      return this.worker;
    }
    // Turbopack 会常量折叠 process.cwd()、把 new Worker(可解析路径) 的入口
    // 打进 server bundle 并改写其中的动态 import()，导致 worker 无法加载运行期
    // 构建的 artifact（"Cannot find module as expression is too dynamic"）。
    // 先读取一个构建期未知的 env 变量，让路径无法被静态折叠，bundler 即不再
    // 追踪该 Worker；worker 始终从磁盘加载未改写的 worker-runtime.mjs。
    const overrideDir = process.env.PIWORK_WORKER_RUNTIME_DIR;
    const runtimePath = overrideDir
      ? join(overrideDir, "worker-runtime.mjs")
      : join(
          process.cwd(),
          "lib",
          "model-plugins",
          "host",
          "worker-runtime.mjs"
        );
    const spawnWorker: typeof Worker = Worker;
    const worker = new spawnWorker(runtimePath, {
      execArgv: [],
      resourceLimits: {
        maxOldGenerationSizeMb: 256,
        maxYoungGenerationSizeMb: 64,
      },
      stderr: true,
      stdout: true,
    });
    worker.unref();
    worker.on("message", (message) => this.handleMessage(message));
    worker.on("error", (error) => this.failAll(error));
    const onExit = (code: number) =>
      this.failAll(
        new Error(`Plugin worker exited unexpectedly (code ${code})`)
      );
    worker.on("exit", onExit);
    this.worker = worker;
    return worker;
  }

  private send(message: HostRequest): void {
    const worker = this.ensureWorker();
    worker.postMessage(message);
  }

  private handleMessage(message: Record<string, unknown>): void {
    const { type } = message;
    if (type === "log") {
      this.logToConsole(message);
      return;
    }
    if (type === "disposed") {
      return;
    }

    const requestId = Number(message.requestId);
    if (type === "event" || type === "invoke-end" || type === "invoke-error") {
      const relay = this.invokes.get(requestId);
      if (!relay) {
        return;
      }
      if (type === "event") {
        relay.onEvent(message.event as AssistantMessageEvent);
      } else if (type === "invoke-error") {
        this.invokes.delete(requestId);
        relay.onError(String(message.message));
      } else {
        this.invokes.delete(requestId);
        relay.onEnd();
      }
      return;
    }

    const pending = this.pending.get(requestId);
    if (!pending) {
      return;
    }
    if (
      type === "activate-error" ||
      type === "inspect-error" ||
      type === "validate-credentials-error"
    ) {
      this.pending.delete(requestId);
      pending.reject(new Error(String(message.message)));
      return;
    }
    if (
      type === "activated" ||
      type === "inspected" ||
      type === "validate-result"
    ) {
      this.pending.delete(requestId);
      pending.resolve(message);
    }
  }

  private logToConsole(message: Record<string, unknown>): void {
    const level = String(message.level ?? "info");
    const text = this.redact(String(message.message ?? ""));
    const prefix = "[piwork-plugin]";
    if (level === "error") {
      console.error(prefix, text);
    } else if (level === "warn") {
      console.warn(prefix, text);
    } else {
      console.info(prefix, text);
    }
  }

  private redact(text: string): string {
    let output = text;
    for (const secret of this.secretValues) {
      if (secret.length >= 8) {
        output = output.split(secret).join("***");
      }
    }
    return output;
  }

  private failAll(error: Error): void {
    for (const [, pending] of this.pending) {
      pending.reject(error);
    }
    this.pending.clear();
    for (const [, relay] of this.invokes) {
      relay.onError(error.message);
    }
    this.invokes.clear();
    this.worker = null;
  }

  /** 激活插件 factory：加载 artifact、注入受限 context、注册 provider */
  activate(request: ActivateProviderRequest): Promise<ActivationSnapshot> {
    this.secretValues = Object.values(request.credentials)
      .filter((value): value is string => typeof value === "string")
      .filter((value) => value.length > 0);

    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    const promise = new Promise<ActivationSnapshot>((resolve, reject) => {
      this.pending.set(requestId, {
        reject,
        resolve: (value) => resolve(value as ActivationSnapshot),
      });
    });

    const factoryContext: Omit<ProviderFactoryContext, "fetch" | "logger"> = {
      config: request.config,
      credentials: request.credentials,
      installationId: request.installationId,
      providerId: request.providerId,
      runtimeProviderId: request.runtimeProviderId,
    };

    this.send({
      artifactEntry: request.artifactEntry,
      context: factoryContext,
      requestId,
      runtimeProviderId: request.runtimeProviderId,
      type: "activate",
    });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Plugin activation timed out")),
        15_000
      ).unref()
    );
    return Promise.race([promise, timeout]);
  }

  /** 仅加载平台重建的 artifact 并读取可序列化 definition，不执行 factory。 */
  inspect(artifactEntry: string): Promise<ProviderDefinition> {
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    const promise = new Promise<ProviderDefinition>((resolve, reject) => {
      this.pending.set(requestId, {
        reject,
        resolve: (value) =>
          resolve((value as { definition: ProviderDefinition }).definition),
      });
    });
    this.send({ artifactEntry, requestId, type: "inspect" });
    return promise;
  }

  async validateCredentials(
    request: ValidateCredentialsRequest
  ): Promise<void> {
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    const promise = new Promise<void>((resolve, reject) => {
      this.pending.set(requestId, {
        reject,
        resolve: () => resolve(undefined),
      });
    });
    this.send({
      artifactEntry: request.artifactEntry,
      config: request.config,
      credentials: request.credentials,
      requestId,
      type: "validate-credentials",
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Credential validation timed out")),
        20_000
      ).unref()
    );
    await Promise.race([promise, timeout]);
  }

  /** 发起一次模型调用；事件异步回传，返回可中止句柄 */
  startInvoke(handlers: {
    context: Context;
    model: Model<Api>;
    onEnd: () => void;
    onEvent: (event: AssistantMessageEvent) => void;
    onError: (message: string) => void;
    options: Record<string, unknown>;
  }): InvokeRelay {
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    this.invokes.set(requestId, {
      onEnd: handlers.onEnd,
      onError: handlers.onError,
      onEvent: handlers.onEvent,
    });
    this.send({
      context: handlers.context,
      model: handlers.model,
      options: handlers.options,
      requestId,
      type: "invoke",
    });
    return new InvokeRelay((message) => this.send(message), requestId);
  }

  async dispose(): Promise<void> {
    const { worker } = this;
    this.worker = null;
    this.failAll(new Error("Plugin host disposed"));
    if (!worker) {
      return;
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        worker.terminate();
        resolve();
      }, 3000);
      timer.unref();
      worker.on("exit", () => {
        clearTimeout(timer);
        resolve();
      });
      worker.postMessage({ type: "dispose" });
    });
  }
}

export type ValidateCredentialsRequest = {
  artifactEntry: string;
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
};

const EMPTY_USAGE = {
  cacheRead: 0,
  cacheWrite: 0,
  cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0 },
  input: 0,
  output: 0,
  totalTokens: 0,
};

function syntheticErrorEvent(
  model: Model<Api>,
  message: string
): AssistantMessageEvent {
  const error: AssistantMessage = {
    api: model.api,
    content: [],
    errorMessage: message,
    model: model.id,
    provider: model.provider,
    role: "assistant",
    stopReason: "error",
    timestamp: Date.now(),
    usage: EMPTY_USAGE,
  };
  return { error, reason: "error", type: "error" };
}

/**
 * 递归剥离 payload 中的函数值（agent 注入的 tool 执行器等）：
 * postMessage 走 structured clone，函数无法跨线程，schema 字段原样保留。
 */
function stripFunctions<T>(value: T): T {
  if (typeof value === "function") {
    return undefined as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripFunctions(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const cleaned = stripFunctions(item);
      if (cleaned !== undefined) {
        output[key] = cleaned;
      }
    }
    return output as unknown as T;
  }
  return value;
}

/**
 * HostedPiProviderAdapter：把 worker 中的 provider 适配回主线程的 Pi
 * Provider interface（架构 §6.2）。stream/streamSimple 把请求转发给
 * PluginHost.invoke，并把回传事件灌入 AssistantMessageEventStream。
 */
export class HostedPiProviderAdapter implements Provider {
  readonly id: string;
  readonly name: string;
  readonly baseUrl?: string;
  readonly auth: ProviderAuth;

  private readonly host: WorkerThreadPluginHost;
  private readonly models: readonly Model<Api>[];
  private readonly apiKey: string;

  constructor(
    snapshot: ActivationSnapshot,
    host: WorkerThreadPluginHost,
    auth: { apiKey: string; name: string }
  ) {
    this.id = snapshot.provider.id;
    this.name = snapshot.provider.name;
    this.baseUrl = snapshot.provider.baseUrl;
    this.models = snapshot.provider.models;
    this.host = host;
    this.apiKey = auth.apiKey;
    this.auth = {
      apiKey: {
        name: auth.name,
        resolve: async () => ({
          auth: { apiKey: this.apiKey },
          source: auth.name,
        }),
      },
    };
  }

  getModels(): readonly Model<Api>[] {
    return this.models;
  }

  stream(
    model: Model<Api>,
    context: Context,
    options?: ApiStreamOptions<Api>
  ): ReturnType<Provider["stream"]> {
    return this.relay(model, context, options);
  }

  streamSimple(
    model: Model<Api>,
    context: Context,
    options?: SimpleStreamOptions
  ): ReturnType<Provider["streamSimple"]> {
    return this.relay(model, context, options);
  }

  private relay(
    model: Model<Api>,
    context: Context,
    options?: ApiStreamOptions<Api> | SimpleStreamOptions
  ) {
    const stream = createAssistantMessageEventStream();
    // signal/fetch 无法跨线程克隆：signal 在本线程订阅转发，fetch 一律由 worker 注入
    const { signal, fetch: _fetch, ...rest } = options ?? {};
    let terminated = false;

    const relayHandle = this.host.startInvoke({
      context: stripFunctions(context),
      model,
      onEnd: () => {
        if (!terminated) {
          terminated = true;
          stream.end();
        }
      },
      onError: (message) => {
        if (!terminated) {
          terminated = true;
          stream.push(syntheticErrorEvent(model, message));
          stream.end();
        }
      },
      onEvent: (event) => {
        if (event.type === "done" || event.type === "error") {
          terminated = true;
        }
        stream.push(event);
      },
      options: stripFunctions(rest) as Record<string, unknown>,
    });

    if (signal) {
      const onAbort = () => relayHandle.abort();
      signal.addEventListener("abort", onAbort, { once: true });
    }

    return stream;
  }
}
