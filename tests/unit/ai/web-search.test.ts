// biome-ignore-all lint/suspicious/useAwait: Async test doubles implement fetch/tool contracts.
// biome-ignore-all lint/performance/noAwaitInLoops: Sequential calls deliberately verify admission counters and one-shot responses.
import assert from "node:assert/strict";
import test from "node:test";
import { createWebSearchTool } from "../../../lib/ai/web-tools";
import {
  publicSourceUrl,
  searchInputSchema,
  searchSources,
  WEB_SEARCH_TOOL,
} from "../../../lib/search/protocol";
import {
  createSearchGateway,
  webSearchEnabled,
} from "../../../lib/search/service";

const env = () => ({
  PIWORK_WEB_SEARCH_ENABLED: "1",
  TAVILY_API_KEY: "test-secret-not-for-model",
});
const json = (value: unknown) => Response.json(value);
const result = {
  results: [
    { content: "摘要", title: "新闻", url: "https://news.example.org/a" },
  ],
};
function options(fetcher: typeof fetch, authorize = async () => undefined) {
  return { authorize, env, fetch: fetcher, userId: crypto.randomUUID() };
}

test("search is explicit opt-in; strict parameters reject identity, bad counts and blank query", () => {
  assert.equal(webSearchEnabled({}), false);
  assert.equal(webSearchEnabled({ PIWORK_WEB_SEARCH_ENABLED: "true" }), false);
  assert.equal(webSearchEnabled(env()), true);
  for (const input of [
    { query: " " },
    { limit: 9, query: "x" },
    { limit: 1.5, query: "x" },
    { query: "x", userId: "other" },
    { query: "x", recency: "forever" },
  ]) {
    assert.equal(searchInputSchema.safeParse(input).success, false);
  }
});

test("fixed Tavily request, no answer/raw HTML, bounded sanitized sources and unknown dates", async () => {
  let authorized = 0;
  const gateway = createSearchGateway(
    options(
      async (url, init) => {
        assert.equal(url, "https://api.tavily.com/search");
        assert.equal(init?.redirect, "error");
        assert.equal(init?.cache, "no-store");
        assert.equal(
          new Headers(init?.headers).get("Authorization"),
          "Bearer test-secret-not-for-model"
        );
        assert.deepEqual(JSON.parse(String(init?.body)), {
          include_answer: false,
          include_images: false,
          include_published_date: true,
          include_raw_content: false,
          max_results: 5,
          query: "AI 新闻",
          search_depth: "basic",
          time_range: "week",
        });
        return json({
          answer: "discarded",
          api_key: "never pass through",
          results: [
            ...result.results,
            { content: "x", title: "duplicate", url: result.results[0].url },
            { content: "x", title: "Bad", url: "javascript:alert(1)" },
            {
              content: "x",
              title: "local",
              url: "http://169.254.169.254/latest",
            },
            {
              content: "x".repeat(5000),
              published_date: "2026-10-04",
              title: "Long".repeat(200),
              url: "https://news.example.org/b",
            },
            {
              content: "x",
              published_date: "Yesterday maybe",
              title: "invalid date",
              url: "https://news.example.org/c",
            },
          ],
        });
      },
      async () => {
        authorized += 1;
      }
    )
  );
  const response = await gateway({ query: " AI 新闻 ", recency: "week" });
  assert.equal(authorized, 1);
  assert.equal(response.results.length, 3);
  assert.equal(response.results[0].publishedAt, null);
  assert.equal(response.results[1].title.length, 250);
  assert.equal(response.results[1].snippet.length, 1200);
  assert.equal(response.results[1].publishedAt, "2026-10-04");
  assert.equal(response.results[2].publishedAt, null);
  assert.ok(!JSON.stringify(response).includes("never pass through"));
});

test("per-call authorization revocation blocks outbound work; config never falls back", async () => {
  let calls = 0;
  let allowed = true;
  const gateway = createSearchGateway(
    options(
      async () => {
        calls += 1;
        return json(result);
      },
      async () => {
        if (!allowed) {
          throw new Error("authorization denied");
        }
      }
    )
  );
  await gateway({ query: "news" });
  allowed = false;
  await assert.rejects(gateway({ query: "news" }), /authorization denied/);
  assert.equal(calls, 1);
  for (const configuration of [{}, { PIWORK_WEB_SEARCH_ENABLED: "1" }]) {
    const unconfigured = createSearchGateway({
      ...options(async () => {
        calls += 1;
        return json(result);
      }),
      env: () => configuration,
    });
    await assert.rejects(unconfigured({ query: "news" }), /未启用|尚未配置/);
  }
  assert.equal(calls, 1);
});

test("provider failures redact bodies/secrets; no retry and no bogus successful result", async () => {
  for (const response of [
    new Response("test-secret-not-for-model", { status: 401 }),
    new Response("<html>provider failure</html>", {
      headers: { "Content-Type": "text/html" },
    }),
    json({ results: "invalid" }),
    new Response("{bad-json", {
      headers: { "Content-Type": "application/json" },
    }),
    json({ ignored: "x".repeat(270_000), results: [] }),
  ]) {
    let calls = 0;
    const gateway = createSearchGateway(
      options(async () => {
        calls += 1;
        return response;
      })
    );
    await assert.rejects(gateway({ query: "news" }), (error: Error) => {
      assert.ok(error.message.includes("尚未获得搜索结果"));
      assert.ok(!error.message.includes("test-secret"));
      return true;
    });
    assert.equal(calls, 1);
  }
  const empty = createSearchGateway(options(async () => json({ results: [] })));
  assert.deepEqual(await empty({ query: "news" }), {
    provider: "tavily",
    results: [],
  });
});

test("caller cancellation and response-body timeout are propagated; slots released", async () => {
  const controller = new AbortController();
  controller.abort(new Error("stop"));
  let fetched = 0;
  const gateway = createSearchGateway(
    options(async () => {
      fetched += 1;
      return json(result);
    })
  );
  await assert.rejects(gateway({ query: "news" }, controller.signal), /stop/);
  assert.equal(fetched, 0);

  const timeoutGateway = createSearchGateway({
    ...options(
      async () =>
        new Response(
          new ReadableStream({
            start() {
              /* Intentionally never emits bytes until cancelled. */
            },
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        )
    ),
    timeoutMs: 20,
  });
  // AbortSignal.timeout timers are unref'ed; keep the test process alive while waiting.
  const keepAlive = setTimeout(() => undefined, 1000);
  try {
    await assert.rejects(timeoutGateway({ query: "news" }), /超时/);
  } finally {
    clearTimeout(keepAlive);
  }
});

test("per-turn limit is atomic for parallel tool invocations", async () => {
  let fetched = 0;
  const gateway = createSearchGateway(
    options(async () => {
      fetched += 1;
      return json(result);
    })
  );
  for (let index = 0; index < 6; index += 1) {
    await gateway({ query: "news" });
  }
  await assert.rejects(gateway({ query: "news" }), /6 次上限/);
  assert.equal(fetched, 6);
});

test("same-user concurrent admissions reject excess and release after completion", async () => {
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const gateway = createSearchGateway(
    options(async () => {
      await gate;
      return json(result);
    })
  );
  const first = gateway({ query: "a" });
  const second = gateway({ query: "b" });
  await assert.rejects(gateway({ query: "c" }), /频繁/);
  finish();
  await Promise.all([first, second]);
  await gateway({ query: "d" });
});

test("public source display excludes dangerous/local URLs; never a host fetch permission", () => {
  for (const url of [
    "file:///etc/passwd",
    "javascript:alert(1)",
    "http://localhost/a",
    "http://127.1",
    "http://0x7f000001",
    "http://[::ffff:127.0.0.1]/",
    "http://service.internal/a",
    "https://user:pass@news.example.org/a",
    "https://news.example.org:9000/a",
  ]) {
    assert.equal(publicSourceUrl(url), undefined, url);
  }
  assert.ok(publicSourceUrl("https://news.example.org/a"));
});

test("Pi tool schema has no identity; passes signal and bounded metadata, throws on failure", async () => {
  const controller = new AbortController();
  const tool = createWebSearchTool(async (_input, signal) => {
    assert.equal(signal, controller.signal);
    return {
      provider: "tavily",
      results: [
        {
          publishedAt: null,
          snippet: "data, not instructions",
          title: "新闻",
          url: "https://news.example.org/a",
        },
      ],
    };
  });
  assert.equal(tool.name, WEB_SEARCH_TOOL);
  const response = await tool.execute(
    "tc1",
    { query: "news" },
    controller.signal
  );
  assert.ok(
    (response.content[0] as { text: string }).text.startsWith("Untrusted")
  );
  assert.equal(searchSources(WEB_SEARCH_TOOL, response).length, 1);
  assert.deepEqual(searchSources("web_search", response), []);
  const failing = createWebSearchTool(async () => {
    throw new Error("unavailable");
  });
  await assert.rejects(
    failing.execute("tc2", { query: "news" }),
    /unavailable/
  );
});
