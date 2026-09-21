import { getTranslations } from "next-intl/server";
import type { ProviderInput } from "@/lib/db/model-queries";
import {
  createProviderRecord,
  listProviderNames,
  loadProvidersView,
} from "@/lib/db/model-queries";
import { ChatbotError } from "@/lib/errors";
import { requireManagementAdmin } from "@/lib/management/access";
import {
  isValidBaseUrl,
  PROVIDER_API_KEY_MAX_LENGTH,
  PROVIDER_BASE_URL_MAX_LENGTH,
  PROVIDER_DESCRIPTION_MAX_LENGTH,
  PROVIDER_NAME_MAX_LENGTH,
} from "@/lib/management/models";

function apiError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function unauthorized() {
  return new ChatbotError("unauthorized:chat").toResponse();
}

/** 解析并校验新增供应商入参；errorCode 由调用方翻译为接口消息 */
function parseProviderInput(
  body: Record<string, unknown>
): { errorCode: string } | { input: ProviderInput } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : null;
  const baseUrl =
    typeof body.baseUrl === "string"
      ? body.baseUrl.trim().replace(/\/+$/, "")
      : "";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

  if (!name) {
    return { errorCode: "providerNameRequired" };
  }
  if (name.length > PROVIDER_NAME_MAX_LENGTH) {
    return { errorCode: "providerNameTooLong" };
  }
  if (description && description.length > PROVIDER_DESCRIPTION_MAX_LENGTH) {
    return { errorCode: "providerDescriptionTooLong" };
  }
  if (!baseUrl) {
    return { errorCode: "providerBaseUrlRequired" };
  }
  if (baseUrl.length > PROVIDER_BASE_URL_MAX_LENGTH) {
    return { errorCode: "providerBaseUrlTooLong" };
  }
  if (!isValidBaseUrl(baseUrl)) {
    return { errorCode: "providerBaseUrlInvalid" };
  }
  if (!apiKey) {
    return { errorCode: "providerApiKeyRequired" };
  }
  if (apiKey.length > PROVIDER_API_KEY_MAX_LENGTH) {
    return { errorCode: "providerApiKeyTooLong" };
  }

  return { input: { apiKey, baseUrl, description, name } };
}

export async function GET() {
  const t = await getTranslations("managementApi");
  const session = await requireManagementAdmin();
  if (!session) {
    return unauthorized();
  }

  try {
    const view = await loadProvidersView();
    return Response.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return apiError(t("loadProvidersFailed"), 500);
  }
}

export async function POST(request: Request) {
  const t = await getTranslations("managementApi");
  const session = await requireManagementAdmin();
  if (!session) {
    return unauthorized();
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parseProviderInput(body);
    if ("errorCode" in parsed) {
      return apiError(t(parsed.errorCode));
    }

    const names = await listProviderNames();
    if (names.includes(parsed.input.name)) {
      return apiError(t("duplicateProvider"), 409);
    }

    const created = await createProviderRecord(parsed.input);
    return Response.json(
      { id: created.id, name: created.name },
      { status: 201 }
    );
  } catch {
    return apiError(t("createProviderFailed"), 500);
  }
}
