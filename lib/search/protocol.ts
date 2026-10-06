import { z } from "zod";

// Platform-owned names deliberately do not collide with pi-web-access/web_search.
export const WEB_SEARCH_TOOL = "platform_web_search";
export const searchInputSchema = z
  .object({
    limit: z.number().int().min(1).max(8).default(5),
    query: z.string().trim().min(1).max(500),
    recency: z.enum(["day", "week", "month", "year"]).optional(),
  })
  .strict();
export type SearchInput = z.input<typeof searchInputSchema>;
export type SearchSource = {
  title: string;
  url: string;
  publishedAt: string | null;
};
export type SearchResult = SearchSource & { snippet: string };
export type SearchResponse = { provider: "tavily"; results: SearchResult[] };

/** Display-only URL validation. We never fetch these URLs on the host.
 * Conservative: IP literals, custom ports and local/special-use names are omitted.
 * This is NOT an SSRF-safe fetch implementation or DNS validation.
 */
export function publicSourceUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) {
    return;
  }
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      /^[\d.]+$/.test(host) ||
      host.includes(":") ||
      !host.includes(".") ||
      /(^|\.)(localhost|local|internal|lan|home|test|invalid|example|onion)$/.test(
        host
      ) ||
      host === "metadata.google.internal"
    ) {
      return;
    }
    return url.href;
  } catch {
    // Invalid URLs are omitted rather than surfaced as source links.
  }
}

/** Project only bounded source metadata from successful platform tool results. */
export function searchSources(
  toolName: string,
  result: unknown
): SearchSource[] {
  if (toolName !== WEB_SEARCH_TOOL || !result || typeof result !== "object") {
    return [];
  }
  const { details } = result as { details?: { sources?: unknown } };
  if (!Array.isArray(details?.sources)) {
    return [];
  }
  const seen = new Set<string>();
  return details.sources.slice(0, 8).flatMap((source: unknown) => {
    if (!source || typeof source !== "object") {
      return [];
    }
    const record = source as Record<string, unknown>;
    const url = publicSourceUrl(record.url);
    if (!url || seen.has(url) || typeof record.title !== "string") {
      return [];
    }
    seen.add(url);
    return [
      {
        publishedAt:
          typeof record.publishedAt === "string"
            ? record.publishedAt.slice(0, 80)
            : null,
        title: record.title.slice(0, 250),
        url,
      },
    ];
  });
}
