import { getTranslations } from "next-intl/server";
import {
  clearDefaultsUnderProvider,
  deleteProviderRecord,
  getProviderById,
  listProviderNames,
  loadProviderDetailView,
  updateProviderRecord,
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const t = await getTranslations("managementApi");
  const session = await requireManagementAdmin();
  if (!session) {
    return unauthorized();
  }

  try {
    const { providerId } = await params;
    const view = await loadProviderDetailView(providerId);
    if (!view) {
      return apiError(t("providerNotFound"), 404);
    }
    return Response.json(view, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return apiError(t("loadProviderFailed"), 500);
  }
}

/**
 * 更新供应商：名称 / 描述 / Base URL / API Key（留空保留原值）/ 启用状态。
 * 停用供应商时，其下默认模型一并取消默认标记。
 */
export async function PATCH(
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
    const target = await getProviderById(providerId);
    if (!target) {
      return apiError(t("providerNotFound"), 404);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const update: {
      apiKey?: string;
      baseUrl?: string;
      description?: string | null;
      enabled?: boolean;
      name?: string;
    } = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return apiError(t("providerNameRequired"));
      }
      if (name.length > PROVIDER_NAME_MAX_LENGTH) {
        return apiError(t("providerNameTooLong"));
      }
      if (name !== target.name) {
        const names = await listProviderNames();
        if (names.includes(name)) {
          return apiError(t("duplicateProvider"), 409);
        }
      }
      update.name = name;
    }

    if (body.description !== undefined) {
      const description =
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : null;
      if (description && description.length > PROVIDER_DESCRIPTION_MAX_LENGTH) {
        return apiError(t("providerDescriptionTooLong"));
      }
      update.description = description;
    }

    if (typeof body.baseUrl === "string") {
      const baseUrl = body.baseUrl.trim().replace(/\/+$/, "");
      if (!baseUrl) {
        return apiError(t("providerBaseUrlRequired"));
      }
      if (baseUrl.length > PROVIDER_BASE_URL_MAX_LENGTH) {
        return apiError(t("providerBaseUrlTooLong"));
      }
      if (!isValidBaseUrl(baseUrl)) {
        return apiError(t("providerBaseUrlInvalid"));
      }
      update.baseUrl = baseUrl;
    }

    if (body.apiKey !== undefined && body.apiKey !== "") {
      // 空字符串表示保留原凭证
      if (typeof body.apiKey !== "string") {
        return apiError(t("providerApiKeyRequired"));
      }
      const apiKey = body.apiKey.trim();
      if (!apiKey) {
        return apiError(t("providerApiKeyRequired"));
      }
      if (apiKey.length > PROVIDER_API_KEY_MAX_LENGTH) {
        return apiError(t("providerApiKeyTooLong"));
      }
      update.apiKey = apiKey;
    }

    if (typeof body.enabled === "boolean" && body.enabled !== target.enabled) {
      update.enabled = body.enabled;
    }

    const updated = await updateProviderRecord(providerId, update);
    if (!updated) {
      return apiError(t("providerNotFound"), 404);
    }

    // 停用供应商后，其默认模型不再可用，同步取消默认标记
    if (update.enabled === false) {
      await clearDefaultsUnderProvider(providerId);
    }

    const view = await loadProviderDetailView(providerId);
    return Response.json(view);
  } catch {
    return apiError(t("updateProviderFailed"), 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const t = await getTranslations("managementApi");
  const session = await requireManagementAdmin();
  if (!session) {
    return unauthorized();
  }

  try {
    const { providerId } = await params;
    const target = await getProviderById(providerId);
    if (!target) {
      return apiError(t("providerNotFound"), 404);
    }

    await deleteProviderRecord(providerId);
    return Response.json({ deleted: true });
  } catch {
    return apiError(t("deleteProviderFailed"), 500);
  }
}
