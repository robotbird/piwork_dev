import "server-only";
import {
  publicSourceUrl,
  type SearchInput,
  type SearchResponse,
  searchInputSchema,
} from "./protocol";

type SearchEnv = Record<string, string | undefined>;

export function webSearchEnabled(env: SearchEnv = process.env): boolean {
  return env.PIWORK_WEB_SEARCH_ENABLED === "1";
}

const MAX_RESPONSE_BYTES = 256 * 1024;
const TIMEOUT_MS = 12_000;
const WINDOW_MS = 60_000;
const shared = globalThis as typeof globalThis & {
  piworkSearchLimits?: {
    active: number;
    users: Map<string, { since: number; calls: number; active: number }>;
  };
};
const limits = shared.piworkSearchLimits ?? { active: 0, users: new Map() };
shared.piworkSearchLimits = limits;

/** Process-local admission only, not a distributed quota/billing ledger. */
function reserve(userId: string): () => void {
  const now = Date.now();
  for (const [id, entry] of limits.users) {
    if (!entry.active && now - entry.since >= WINDOW_MS) {
      limits.users.delete(id);
    }
  }
  let entry = limits.users.get(userId);
  if (!entry) {
    if (limits.users.size >= 1000) {
      throw new Error("联网搜索繁忙，请稍后重试。");
    }
    entry = { active: 0, calls: 0, since: now };
    limits.users.set(userId, entry);
  }
  if (now - entry.since >= WINDOW_MS) {
    entry.since = now;
    entry.calls = 0;
  }
  if (entry.calls >= 20 || entry.active >= 2 || limits.active >= 8) {
    throw new Error("联网搜索调用过于频繁，请稍后重试。");
  }
  entry.calls += 1;
  entry.active += 1;
  limits.active += 1;
  return () => {
    entry.active -= 1;
    limits.active -= 1;
  };
}

async function boundedJson(
  response: Response,
  signal: AbortSignal
): Promise<unknown> {
  if (
    !response.headers.get("content-type")?.includes("application/json") ||
    !response.body
  ) {
    await response.body?.cancel();
    throw new Error("invalid response");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const abort = () => {
    reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      // biome-ignore lint/performance/noAwaitInLoops: Stream reads must be sequential and bounded.
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) {
        break;
      }
      size += chunk.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        throw new Error("oversized response");
      }
      chunks.push(chunk.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function normalize(data: unknown, limit: number): SearchResponse {
  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray((data as { results?: unknown }).results)
  ) {
    throw new Error("invalid results");
  }
  const seen = new Set<string>();
  const results = (data as { results: unknown[] }).results
    .slice(0, 32)
    .flatMap((value) => {
      if (!value || typeof value !== "object") {
        return [];
      }
      const item = value as Record<string, unknown>;
      const url = publicSourceUrl(item.url);
      if (
        !url ||
        seen.has(url) ||
        typeof item.title !== "string" ||
        typeof item.content !== "string"
      ) {
        return [];
      }
      seen.add(url);
      // Preserve only an explicit parseable provider date; never infer it from retrieval time.
      const publishedAt =
        typeof item.published_date === "string" &&
        Number.isFinite(Date.parse(item.published_date))
          ? item.published_date.slice(0, 80)
          : null;
      return [
        {
          publishedAt,
          snippet: item.content.slice(0, 1200),
          title: item.title.slice(0, 250),
          url,
        },
      ];
    })
    .slice(0, limit);
  return { provider: "tavily", results };
}

/** Per-turn gateway. Identity is bound by the host, never supplied by the model.
 * Exactly one fixed search provider/endpoint, no retries/fallback or arbitrary fetch.
 */
export function createSearchGateway(options: {
  userId: string;
  authorize: () => Promise<void>;
  fetch?: typeof fetch;
  env?: () => SearchEnv;
  timeoutMs?: number;
}) {
  let calls = 0;
  return async (
    input: SearchInput,
    signal?: AbortSignal
  ): Promise<SearchResponse> => {
    signal?.throwIfAborted();
    const args = searchInputSchema.parse(input);
    const env = options.env?.() ?? process.env;
    if (!webSearchEnabled(env)) {
      throw new Error("平台联网搜索未启用。");
    }
    const apiKey = env.TAVILY_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "平台联网搜索尚未配置，请联系管理员设置 Tavily API Key。"
      );
    }
    // Authorization exceptions must block outbound work; do not substitute identities.
    await options.authorize();
    signal?.throwIfAborted();
    if (calls >= 6) {
      throw new Error("本轮联网搜索已达到 6 次上限。");
    }
    const release = reserve(options.userId);
    calls += 1;
    const deadline = AbortSignal.any([
      AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS),
      ...(signal ? [signal] : []),
    ]);
    try {
      const response = await (options.fetch ?? fetch)(
        "https://api.tavily.com/search",
        {
          body: JSON.stringify({
            max_results: args.limit,
            query: args.query,
            search_depth: "basic",
            ...(args.recency ? { time_range: args.recency } : {}),
            include_answer: false,
            include_images: false,
            include_published_date: true,
            include_raw_content: false,
          }),
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          redirect: "error",
          signal: deadline,
        }
      );
      if (!response.ok) {
        await response.body?.cancel();
        // Never expose provider bodies, request headers, tokens, or transport URLs.
        throw new Error("provider rejected request");
      }
      return normalize(await boundedJson(response, deadline), args.limit);
    } catch {
      signal?.throwIfAborted();
      // biome-ignore lint/style/useErrorCause: Transport causes can contain credentials; never retain them in logs or tool results.
      throw new Error(
        deadline.aborted
          ? "联网搜索超时，请稍后重试。"
          : "联网搜索服务暂时不可用，请稍后重试；尚未获得搜索结果。"
      );
    } finally {
      release();
    }
  };
}
