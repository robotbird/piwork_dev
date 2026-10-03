import { getTranslations } from "next-intl/server";
import { invalidateActiveModelCatalog } from "@/lib/ai/active-models";
import {
  createPluginInstallation,
  getPluginInstallationByProviderKey,
} from "@/lib/db/model-plugin-queries";
import { ChatbotError } from "@/lib/errors";
import { requireManagementAdmin } from "@/lib/management/access";
import { getBuiltinPluginPackage } from "@/lib/model-plugins/builtin-catalog";
import { encryptPluginCredentials } from "@/lib/model-plugins/credentials";
import { ProviderPluginManager } from "@/lib/model-plugins/manager";
import {
  pickLocalizedText,
  resetPluginRegistry,
} from "@/lib/model-plugins/registry";
import { loadModelPluginsView } from "@/lib/model-plugins/view";

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

export async function GET() {
  const session = await requireManagementAdmin();
  if (!session) {
    return unauthorized();
  }
  try {
    const view = await loadModelPluginsView();
    return Response.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, 500);
  }
}

export async function POST(request: Request) {
  const t = await getTranslations("managementApi");
  const session = await requireManagementAdmin();
  if (!session) {
    return unauthorized();
  }
  try {
    const body = (await request.json()) as {
      packageId?: string;
    };
    if (!body.packageId) {
      return errorResponse(new Error(t("pluginPackageRequired")));
    }
    const pluginPackage = await getBuiltinPluginPackage(body.packageId);
    if (!pluginPackage) {
      return errorResponse(new Error(t("pluginPackageNotFound")), 404);
    }
    if (await getPluginInstallationByProviderKey(pluginPackage.providerKey)) {
      return errorResponse(new Error(t("providerAlreadyInstalled")), 409);
    }
    const manager = new ProviderPluginManager();
    const installation = await manager.install(
      pluginPackage.fileName,
      pluginPackage.zipBytes
    );
    const record = await createPluginInstallation({
      buildHash: installation.artifact.buildHash,
      createdBy: session.userId,
      credentialSummary: {},
      credentialsConfigured: false,
      defaultModelId: null,
      definition: pluginPackage.definition,
      description: pickLocalizedText(pluginPackage.definition.description),
      displayName: pickLocalizedText(pluginPackage.definition.name),
      enabledModels: [],
      encryptedCredentials: encryptPluginCredentials({}),
      packageId: pluginPackage.packageId,
      providerKey: pluginPackage.providerKey,
      sha256: installation.inspection.sha256,
      version: pluginPackage.version,
    });
    resetPluginRegistry();
    invalidateActiveModelCatalog();
    return Response.json({ id: record.id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
