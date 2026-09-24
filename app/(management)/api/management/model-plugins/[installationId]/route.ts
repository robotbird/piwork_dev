import { getLocale, getTranslations } from "next-intl/server";
import { invalidateActiveModelCatalog } from "@/lib/ai/active-models";
import {
  deletePluginInstallation,
  getPluginInstallation,
  updatePluginInstallation,
} from "@/lib/db/model-plugin-queries";
import { ChatbotError } from "@/lib/errors";
import { requireManagementAdmin } from "@/lib/management/access";
import { asProviderDefinition } from "@/lib/management/model-plugins";
import { getBuiltinPluginPackage } from "@/lib/model-plugins/builtin-catalog";
import {
  decryptPluginCredentials,
  encryptPluginCredentials,
  summarizeCredentials,
} from "@/lib/model-plugins/credentials";
import { ProviderPluginManager } from "@/lib/model-plugins/manager";
import {
  pickLocalizedText,
  resetPluginRegistry,
} from "@/lib/model-plugins/registry";

function unauthorized() {
  return new ChatbotError("unauthorized:chat").toResponse();
}

async function errorResponse(error: unknown, status = 400) {
  const t = await getTranslations("managementApi");
  return Response.json(
    { error: error instanceof Error ? error.message : t("operationFailed") },
    { status }
  );
}

function invalidate() {
  resetPluginRegistry();
  invalidateActiveModelCatalog();
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ installationId: string }> }
) {
  const t = await getTranslations("managementApi");
  const locale = await getLocale();
  const session = await requireManagementAdmin();
  if (!session) {
    return unauthorized();
  }
  try {
    const { installationId } = await params;
    const record = await getPluginInstallation(installationId);
    if (!record) {
      return errorResponse(new Error(t("pluginInstallationNotFound")), 404);
    }
    const body = (await request.json()) as {
      credentials?: Record<string, unknown>;
      defaultModelId?: string | null;
      enabled?: boolean;
      enabledModels?: string[];
    };
    const update: Parameters<typeof updatePluginInstallation>[1] = {};
    if (typeof body.enabled === "boolean") {
      update.enabled = body.enabled;
      if (!body.enabled) {
        update.defaultModelId = null;
      }
    }
    const definition = asProviderDefinition(record.definition);
    const knownIds = new Set(definition.models.map((model) => model.modelId));
    if (body.enabledModels) {
      if (
        body.enabledModels.length > 0 &&
        !record.credentialsConfigured &&
        !body.credentials
      ) {
        return errorResponse(new Error(t("configureApiKeyFirst")));
      }
      if (body.enabledModels.some((id) => !knownIds.has(id))) {
        return errorResponse(new Error(t("unknownModelInCatalog")));
      }
      update.enabledModels = body.enabledModels;
      if (
        record.defaultModelId &&
        !body.enabledModels.includes(record.defaultModelId) &&
        body.defaultModelId === undefined
      ) {
        update.defaultModelId = null;
      }
    }
    if (body.defaultModelId !== undefined) {
      if (body.defaultModelId && !knownIds.has(body.defaultModelId)) {
        return errorResponse(new Error(t("defaultModelNotFound")));
      }
      const enabledModels = update.enabledModels ?? record.enabledModels;
      if (body.defaultModelId && !enabledModels.includes(body.defaultModelId)) {
        return errorResponse(new Error(t("defaultModelMustBeEnabled")));
      }
      update.defaultModelId = body.defaultModelId;
    }
    if (body.credentials) {
      const pluginPackage = await getBuiltinPluginPackage(record.packageId);
      if (!pluginPackage) {
        return errorResponse(new Error(t("pluginPackageNotFound")), 404);
      }
      const manager = new ProviderPluginManager();
      const installation = await manager.install(
        pluginPackage.fileName,
        pluginPackage.zipBytes
      );
      const currentCredentials = decryptPluginCredentials(
        record.encryptedCredentials
      );
      const nextCredentials = {
        ...currentCredentials,
        ...Object.fromEntries(
          Object.entries(body.credentials).filter(
            ([, value]) => typeof value !== "string" || value.trim().length > 0
          )
        ),
      };
      for (const field of definition.credentialFields) {
        if (
          field.required &&
          (typeof nextCredentials[field.variable] !== "string" ||
            !String(nextCredentials[field.variable]).trim())
        ) {
          return errorResponse(
            new Error(
              t("credentialFieldRequired", {
                field:
                  field.label[locale === "zh" ? "zh-CN" : "en"] ??
                  pickLocalizedText(field.label),
              })
            )
          );
        }
      }
      await manager.validateCredentials(installation, nextCredentials);
      update.encryptedCredentials = encryptPluginCredentials(nextCredentials);
      update.credentialSummary = summarizeCredentials(nextCredentials);
      update.credentialsConfigured = true;
      update.healthStatus = "healthy";
    }
    await updatePluginInstallation(installationId, update);
    invalidate();
    return Response.json({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ installationId: string }> }
) {
  const t = await getTranslations("managementApi");
  const session = await requireManagementAdmin();
  if (!session) {
    return unauthorized();
  }
  try {
    const { installationId } = await params;
    if (!(await getPluginInstallation(installationId))) {
      return errorResponse(new Error(t("pluginInstallationNotFound")), 404);
    }
    await deletePluginInstallation(installationId);
    invalidate();
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error, 500);
  }
}
