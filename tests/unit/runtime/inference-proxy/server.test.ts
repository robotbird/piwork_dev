import "../../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import type { Api, Model, Provider } from "@earendil-works/pi-ai";
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
} from "@earendil-works/pi-ai";
import type { PiMessagesEvent } from "@earendil-works/pi-ai/api/pi-messages";
import {
  type InferenceAuditEntry,
  InferenceProxyServer,
  type RunTokenGrant,
  RunTokenRegistry,
  type UpstreamResolver,
} from "@/lib/runtime/inference-proxy";

/**
 * InferenceProxyServer 专测（spec §6 Phase 4，v2.0 §7.2）：真 HTTP + 临时
 * 端口上验证官方 pi-messages wire 服务端契约——Bearer run token 鉴权、
 * 窄权限模型匹配、SSE 事件流（fauxProvider 官方测试替身为上游）、终态
 * 合成、审计脱敏记录。客户端语义对端（错误体形状、SSE 帧、无终态即硬错）
 * 依据 pi-ai dist/api/pi-messages.js。
 */

const CHAT_ID = "00000000-0000-0000-0000-0000000000bb";
const GRANTS = [{ model: "deepseek-flash", provider: "deepseek" }];

type Booted = {
  audit: InferenceAuditEntry[];
  close: () => Promise<void>;
  mint: (grants?: RunTokenGrant["grants"]) => string;
  url: string;
};

async function boot(options?: {
  maxBodyBytes?: number;
  resolver?: UpstreamResolver;
}): Promise<Booted> {
  const audit: InferenceAuditEntry[] = [];
  const tokens = new RunTokenRegistry();
  const server = new InferenceProxyServer({
    audit: {
      record: (entry) => {
        audit.push(entry);
      },
    },
    resolver: options?.resolver ?? (() => null),
    tokens,
    ...(options?.maxBodyBytes === undefined
      ? {}
      : { maxBodyBytes: options.maxBodyBytes }),
  });
  const { url } = await server.listen();
  return {
    audit,
    close: () => server.close(),
    mint: (grants = GRANTS) =>
      tokens.mint({ chatId: CHAT_ID, grants, runId: "run-srv-1" }).token,
    url,
  };
}

function validBody(model = "deepseek-flash"): string {
  return JSON.stringify({
    context: {
      messages: [
        {
          content: [{ text: "你好", type: "text" }],
          role: "user",
          timestamp: Date.now(),
        },
      ],
    },
    model,
    options: { sessionId: "s1", temperature: 0.5 },
  });
}

async function post(
  url: string,
  body: string,
  token?: string
): Promise<{ status: number; contentType: string; text: string }> {
  const response = await fetch(`${url}/messages`, {
    body,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    method: "POST",
  });
  return {
    contentType: response.headers.get("content-type") ?? "",
    status: response.status,
    text: await response.text(),
  };
}

function parseSse(text: string): PiMessagesEvent[] {
  const events: PiMessagesEvent[] = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("data: ")) {
      const payload = line.slice("data: ".length);
      if (payload !== "[DONE]") {
        events.push(JSON.parse(payload) as PiMessagesEvent);
      }
    }
  }
  return events;
}

/** 等待审计条目出现（SSE 完成路径的审计在响应结束后异步落） */
async function waitForAudit(
  audit: InferenceAuditEntry[],
  count: number
): Promise<void> {
  const deadline = Date.now() + 5000;
  while (audit.length < count && Date.now() < deadline) {
    // biome-ignore lint/performance/noAwaitInLoops: 轮询等待异步落盘的审计条目
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(
    audit.length >= count,
    `应在 5s 内记录 ${count} 条审计（实际 ${audit.length}）`
  );
}

test("路由：GET /healthz 探活；其余 404", async () => {
  const proxy = await boot();
  try {
    const health = await fetch(`${proxy.url}/healthz`);
    assert.equal(health.status, 200);
    assert.equal(await health.text(), "ok");
    const other = await fetch(`${proxy.url}/other`, {
      body: "{}",
      method: "POST",
    });
    assert.equal(other.status, 404);
    const { error } = JSON.parse(await other.text());
    assert.equal(error.code, "not_found");
    assert.equal(typeof error.message, "string");
  } finally {
    await proxy.close();
  }
});

test("鉴权：无 / 坏 token 一律 401，审计脱敏（runId null，不区分原因）", async () => {
  const proxy = await boot();
  try {
    for (const token of [
      undefined,
      "not-a-token",
      proxy.mint().replace(/./g, "0"),
    ]) {
      // biome-ignore lint/performance/noAwaitInLoops: 顺序逐个断言三次拒绝响应
      const result = await post(proxy.url, validBody(), token);
      assert.equal(result.status, 401);
      const { error } = JSON.parse(result.text);
      assert.equal(error.code, "unauthorized");
    }
    await waitForAudit(proxy.audit, 3);
    for (const entry of proxy.audit) {
      assert.equal(entry.status, "denied");
      assert.equal(entry.errorCode, "unauthorized");
      assert.equal(entry.runId, null);
      assert.equal(entry.chatId, null);
    }
  } finally {
    await proxy.close();
  }
});

test("请求体：坏 JSON / 缺字段 / 超限 → 400/413，审计带 runId", async () => {
  const proxy = await boot({ maxBodyBytes: 64 });
  try {
    const token = proxy.mint();
    const badJson = await post(proxy.url, "{not json", token);
    assert.equal(badJson.status, 400);
    assert.equal(JSON.parse(badJson.text).error.code, "bad_request");

    const badShape = await post(
      proxy.url,
      JSON.stringify({ model: "m" }),
      token
    );
    assert.equal(badShape.status, 400);

    const tooLarge = await post(proxy.url, `${"x".repeat(128)}`, token);
    assert.equal(tooLarge.status, 413);
    assert.equal(JSON.parse(tooLarge.text).error.code, "payload_too_large");

    await waitForAudit(proxy.audit, 3);
    for (const entry of proxy.audit) {
      assert.equal(entry.runId, "run-srv-1");
      assert.equal(entry.chatId, CHAT_ID);
      assert.equal(entry.status, "denied");
    }
    assert.deepEqual(proxy.audit.map((entry) => entry.errorCode).sort(), [
      "bad_request",
      "bad_request",
      "payload_too_large",
    ]);
  } finally {
    await proxy.close();
  }
});

test("窄权限：未授权模型 403 model_not_allowed；同 id 多 provider 403 model_ambiguous", async () => {
  const proxy = await boot();
  try {
    const token = proxy.mint();
    const notAllowed = await post(proxy.url, validBody("gpt-9"), token);
    assert.equal(notAllowed.status, 403);
    assert.equal(JSON.parse(notAllowed.text).error.code, "model_not_allowed");

    const ambiguousToken = proxy.mint([
      { model: "deepseek-flash", provider: "deepseek" },
      { model: "deepseek-flash", provider: "other" },
    ]);
    const ambiguous = await post(proxy.url, validBody(), ambiguousToken);
    assert.equal(ambiguous.status, 403);
    assert.equal(JSON.parse(ambiguous.text).error.code, "model_ambiguous");

    await waitForAudit(proxy.audit, 2);
    assert.deepEqual(
      proxy.audit.map((entry) => entry.errorCode),
      ["model_not_allowed", "model_ambiguous"]
    );
  } finally {
    await proxy.close();
  }
});

test("上游不可解析 → 503 upstream_unavailable（审计 status error）", async () => {
  const proxy = await boot();
  try {
    const result = await post(proxy.url, validBody(), proxy.mint());
    assert.equal(result.status, 503);
    assert.equal(JSON.parse(result.text).error.code, "upstream_unavailable");
    await waitForAudit(proxy.audit, 1);
    assert.equal(proxy.audit[0].status, "error");
    assert.equal(proxy.audit[0].errorCode, "upstream_unavailable");
    assert.equal(proxy.audit[0].provider, "deepseek");
  } finally {
    await proxy.close();
  }
});

test("全链路：fauxProvider 上游 → SSE 官方事件序列 + allowed 审计含用量", async () => {
  const faux = fauxProvider({
    models: [{ id: "deepseek-flash", name: "DeepSeek Flash" }],
    provider: "deepseek",
    tokensPerSecond: 0,
  });
  faux.setResponses([fauxAssistantMessage([fauxText("沙箱内代理回答")])]);
  const proxy = await boot({
    resolver: () => ({
      model: faux.getModel("deepseek-flash") as Model<Api>,
      provider: faux.provider,
    }),
  });
  try {
    const result = await post(proxy.url, validBody(), proxy.mint());
    assert.equal(result.status, 200);
    assert.match(result.contentType, /text\/event-stream/);
    const events = parseSse(result.text);
    assert.equal(events[0]?.type, "start");
    const deltas = events
      .filter(
        (event): event is Extract<PiMessagesEvent, { type: "text_delta" }> =>
          event.type === "text_delta"
      )
      .map((event) => event.delta)
      .join("");
    assert.equal(deltas, "沙箱内代理回答");
    const textEnd = events.find(
      (event): event is Extract<PiMessagesEvent, { type: "text_end" }> =>
        event.type === "text_end"
    );
    assert.equal(textEnd?.content, "沙箱内代理回答");
    const done = events.at(-1);
    assert.equal(done?.type, "done");
    if (done.type === "done") {
      assert.equal(done.reason, "stop");
      assert.ok(done.usage.input > 0, "faux 估算输入 token 应计入审计");
      assert.ok(done.usage.output > 0);
    }
    await waitForAudit(proxy.audit, 1);
    const [entry] = proxy.audit;
    assert.equal(entry.status, "allowed");
    assert.equal(entry.errorCode, undefined);
    assert.equal(entry.provider, "deepseek");
    assert.equal(entry.model, "deepseek-flash");
    assert.equal(entry.runId, "run-srv-1");
    assert.equal(entry.chatId, CHAT_ID);
    assert.ok((entry.inputTokens ?? 0) > 0);
    assert.ok((entry.outputTokens ?? 0) > 0);
    assert.ok((entry.durationMs ?? 0) >= 0);
  } finally {
    await proxy.close();
  }
});

test("上游违约（无终态事件）：合成官方 error 事件收尾 + upstream_error 审计", async () => {
  const noTerminal: UpstreamResolver = () => ({
    model: {} as Model<Api>,
    provider: {
      // biome-ignore lint/suspicious/useAwait: 生成器只产出事件，无等待点
      async *stream() {
        yield { partial: { content: [] }, type: "start" };
        // 直接结束：无 done/error 终态（违反官方流契约）
      },
    } as unknown as Provider,
  });
  const proxy = await boot({ resolver: noTerminal });
  try {
    const result = await post(proxy.url, validBody(), proxy.mint());
    assert.equal(result.status, 200);
    const events = parseSse(result.text);
    assert.equal(events[0]?.type, "start");
    const last = events.at(-1);
    assert.equal(last?.type, "error");
    if (last.type === "error") {
      assert.equal(
        last.errorMessage,
        "upstream stream ended without a terminal event"
      );
      assert.equal(last.usage.input, 0);
    }
    await waitForAudit(proxy.audit, 1);
    assert.equal(proxy.audit[0].status, "error");
    assert.equal(proxy.audit[0].errorCode, "upstream_error");
  } finally {
    await proxy.close();
  }
});

test("客户端中途断开：感知断连中止上游，审计记 client_aborted", async () => {
  const abortable: UpstreamResolver = () => ({
    model: {} as Model<Api>,
    provider: {
      stream(_model: unknown, _context: unknown, options: unknown) {
        const signal = (options as { signal?: AbortSignal } | undefined)
          ?.signal;
        return (async function* streamEvents() {
          yield { partial: { content: [] }, type: "start" };
          // 挂起直到断连 abort —— 上游由此感知并失败
          await new Promise((_, reject) => {
            if (signal?.aborted) {
              reject(new Error("aborted"));
              return;
            }
            signal?.addEventListener("abort", () =>
              reject(new Error("aborted"))
            );
          });
        })();
      },
    } as unknown as Provider,
  });
  const proxy = await boot({ resolver: abortable });
  try {
    const controller = new AbortController();
    const response = await fetch(`${proxy.url}/messages`, {
      body: validBody(),
      headers: {
        authorization: `Bearer ${proxy.mint()}`,
        "content-type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });
    assert.equal(response.status, 200);
    const reader = response.body?.getReader();
    assert.ok(reader);
    await reader.read(); // 收到头部/首帧后中途断开
    controller.abort();
    await reader.read().catch(() => undefined);
    await waitForAudit(proxy.audit, 1);
    assert.equal(proxy.audit[0].status, "error");
    assert.equal(proxy.audit[0].errorCode, "client_aborted");
  } finally {
    await proxy.close();
  }
});
