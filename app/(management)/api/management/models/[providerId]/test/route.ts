import { getTranslations } from "next-intl/server";
import { getModelById, getProviderById } from "@/lib/db/model-queries";
import { ChatbotError } from "@/lib/errors";
import { requireManagementAdmin } from "@/lib/management/access";
import { MODEL_TEST_PROMPT } from "@/lib/management/models";

function apiError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function unauthorized() {
  return new ChatbotError("unauthorized:chat").toResponse();
}

/** 截断上游错误信息，避免把整段响应体下发给前端 */
function clipMessage(text: string, maxLength = 200): string {
  const normalized = text.trim().replace(/\s+/g, " ");
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}…`
    : normalized;
}

export type ModelTestResult = {
  error?: string;
  latencyMs?: number;
  ok: boolean;
  reply?: string;
};

/**
 * 测试模型连通性：按 OpenAI 兼容协议向供应商发起一次最小补全请求，
 * 返回是否成功、耗时与首条回复片段。停用中的模型同样允许测试。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const t = await getTranslations("managementApi");
  const session = await requireManagementAdmin();
  if (!session) {
    return unauthorized();
  }

  try {
    const { providerId } = await params;
    const provider = await getProviderById(providerId);
    if (!provider) {
      return apiError(t("providerNotFound"), 404);
    }

    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown;
    };
    if (typeof body.id !== "string") {
      return apiError(t("modelIdRequired"));
    }
    const model = await getModelById(body.id);
    if (!model || model.providerId !== providerId) {
      return apiError(t("modelNotFound"), 404);
    }

    const endpoint = `${provider.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const startedAt = Date.now();
    let response: Response;
    try {
      response = await fetch(endpoint, {
        body: JSON.stringify({
          max_tokens: 16,
          messages: [{ content: MODEL_TEST_PROMPT, role: "user" }],
          model: model.modelId,
          stream: false,
        }),
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const reason =
        error instanceof Error && error.name === "TimeoutError"
          ? t("testTimedOut")
          : t("testNetworkError");
      const result: ModelTestResult = {
        error: reason,
        latencyMs,
        ok: false,
      };
      return Response.json(result);
    }

    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      const detail = await response
        .text()
        .then((text) => clipMessage(text))
        .catch(() => "");
      const result: ModelTestResult = {
        error: detail
          ? `HTTP ${response.status}: ${detail}`
          : `HTTP ${response.status}`,
        latencyMs,
        ok: false,
      };
      return Response.json(result);
    }

    const data = (await response.json().catch(() => null)) as {
      choices?: { message?: { content?: unknown } }[];
    } | null;
    const replyContent = data?.choices?.[0]?.message?.content;
    const result: ModelTestResult = {
      latencyMs,
      ok: true,
      reply:
        typeof replyContent === "string" && replyContent.trim()
          ? clipMessage(replyContent, 80)
          : undefined,
    };
    return Response.json(result);
  } catch {
    return apiError(t("testModelFailed"), 500);
  }
}
