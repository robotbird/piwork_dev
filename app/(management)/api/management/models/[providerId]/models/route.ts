import { getTranslations } from "next-intl/server";
import {
  createModelRecord,
  deleteModelRecord,
  getModelById,
  getProviderById,
  listModelIdsUnderProvider,
  loadProviderDetailView,
  updateModelRecord,
} from "@/lib/db/model-queries";
import { ChatbotError } from "@/lib/errors";
import { requireManagementAdmin } from "@/lib/management/access";
import {
  MODEL_ID_MAX_LENGTH,
  MODEL_NAME_MAX_LENGTH,
  type ProviderModelType,
} from "@/lib/management/models";

function apiError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function unauthorized() {
  return new ChatbotError("unauthorized:chat").toResponse();
}

const MODEL_TYPES: readonly ProviderModelType[] = ["chat", "multimodal"];

type ParsedModelFields =
  | { errorCode: string }
  | {
      fields: { modelId: string; name: string; type: ProviderModelType };
    };

/** 解析模型名称 / Model ID 公共字段；type 可选，缺省按对话模型处理 */
function parseModelFields(body: Record<string, unknown>): ParsedModelFields {
  const type = typeof body.type === "string" ? body.type : "chat";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";

  if (!name) {
    return { errorCode: "modelNameRequired" };
  }
  if (name.length > MODEL_NAME_MAX_LENGTH) {
    return { errorCode: "modelNameTooLong" };
  }
  if (!modelId) {
    return { errorCode: "modelIdRequired" };
  }
  if (modelId.length > MODEL_ID_MAX_LENGTH) {
    return { errorCode: "modelIdTooLong" };
  }
  if (!MODEL_TYPES.includes(type as ProviderModelType)) {
    return { errorCode: "modelTypeInvalid" };
  }
  return { fields: { modelId, name, type: type as ProviderModelType } };
}

/** 在供应商下新增模型；设为默认时要求供应商处于启用状态 */
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

    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parseModelFields(body);
    if ("errorCode" in parsed) {
      return apiError(t(parsed.errorCode));
    }
    const isDefault = body.isDefault === true;
    if (isDefault && (!provider.enabled || body.enabled === false)) {
      return apiError(t("defaultRequiresEnabled"));
    }

    const existingIds = await listModelIdsUnderProvider(providerId);
    if (existingIds.includes(parsed.fields.modelId)) {
      return apiError(t("duplicateModel"), 409);
    }

    await createModelRecord(providerId, {
      ...parsed.fields,
      enabled: body.enabled !== false,
      isDefault,
    });

    const view = await loadProviderDetailView(providerId);
    return Response.json(view, { status: 201 });
  } catch {
    return apiError(t("createModelFailed"), 500);
  }
}

/**
 * 更新模型：body.id 为模型记录 id。
 * 停用默认模型时自动取消其默认标记；设为默认要求模型与供应商均处于启用状态。
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
    const provider = await getProviderById(providerId);
    if (!provider) {
      return apiError(t("providerNotFound"), 404);
    }

    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.id !== "string") {
      return apiError(t("modelIdRequired"));
    }
    const target = await getModelById(body.id);
    if (!target || target.providerId !== providerId) {
      return apiError(t("modelNotFound"), 404);
    }

    const update: {
      enabled?: boolean;
      isDefault?: boolean;
      modelId?: string;
      name?: string;
      type?: ProviderModelType;
    } = {};

    if (
      body.name !== undefined ||
      body.modelId !== undefined ||
      body.type !== undefined
    ) {
      const parsed = parseModelFields({
        modelId: body.modelId ?? target.modelId,
        name: body.name ?? target.name,
        type: body.type ?? target.type,
      });
      if ("errorCode" in parsed) {
        return apiError(t(parsed.errorCode));
      }
      if (parsed.fields.modelId !== target.modelId) {
        const existingIds = await listModelIdsUnderProvider(providerId);
        if (existingIds.includes(parsed.fields.modelId)) {
          return apiError(t("duplicateModel"), 409);
        }
      }
      update.modelId = parsed.fields.modelId;
      update.name = parsed.fields.name;
      if (body.type !== undefined) {
        update.type = parsed.fields.type;
      }
    }

    if (typeof body.enabled === "boolean" && body.enabled !== target.enabled) {
      update.enabled = body.enabled;
    }
    if (
      typeof body.isDefault === "boolean" &&
      body.isDefault !== target.isDefault
    ) {
      update.isDefault = body.isDefault;
    }

    const nextEnabled = update.enabled ?? target.enabled;
    if (update.isDefault === true && (!nextEnabled || !provider.enabled)) {
      return apiError(t("defaultRequiresEnabled"));
    }

    if (Object.keys(update).length === 0) {
      const view = await loadProviderDetailView(providerId);
      return Response.json(view);
    }

    // 停用默认模型时同步取消默认标记
    if (update.enabled === false && target.isDefault) {
      update.isDefault = false;
    }

    await updateModelRecord(target.id, update);
    const view = await loadProviderDetailView(providerId);
    return Response.json(view);
  } catch {
    return apiError(t("updateModelFailed"), 500);
  }
}

export async function DELETE(
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

    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.id !== "string") {
      return apiError(t("modelIdRequired"));
    }
    const target = await getModelById(body.id);
    if (!target || target.providerId !== providerId) {
      return apiError(t("modelNotFound"), 404);
    }

    await deleteModelRecord(target.id);
    const view = await loadProviderDetailView(providerId);
    return Response.json(view);
  } catch {
    return apiError(t("deleteModelFailed"), 500);
  }
}
