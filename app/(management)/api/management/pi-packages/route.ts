import { getTranslations } from "next-intl/server";
import { listPiPackages } from "@/lib/db/pi-package-queries";
import { ChatbotError } from "@/lib/errors";
import { requireManagementAdmin } from "@/lib/management/access";
import {
  ensureSystemPiPackagesInstalled,
  installPiPackage,
  PiPackageError,
  uninstallPiPackage,
} from "@/lib/pi-packages/manager";

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

/** PiPackageErrorCode → (i18n key, HTTP status) */
const ERROR_MAP: Record<string, { key: string; status: number }> = {
  alreadyInstalled: { key: "piAlreadyInstalled", status: 409 },
  installFailed: { key: "piInstallFailed", status: 500 },
  invalidSource: { key: "piInvalidSource", status: 400 },
  notFound: { key: "piNotFound", status: 404 },
  systemProtected: { key: "piSystemProtected", status: 400 },
};

function piPackageErrorResponse(error: PiPackageError) {
  return getTranslations("managementApi").then((t) => {
    const mapped = ERROR_MAP[error.code] ?? {
      key: "operationFailed",
      status: 500,
    };
    return Response.json(
      {
        detail: error.detail,
        error: t(mapped.key),
      },
      { status: mapped.status }
    );
  });
}

/** 管理端 pi 官方插件:已装列表/安装/卸载;仅管理员可用。 */
export async function GET() {
  const session = await requireManagementAdmin();
  if (!session) {
    return unauthorized();
  }
  try {
    const systemPackageStatus = await ensureSystemPiPackagesInstalled();
    const packages = await listPiPackages();
    return Response.json(
      { packages, systemPackageStatus },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return errorResponse(error, 500);
  }
}

export async function POST(request: Request) {
  const session = await requireManagementAdmin();
  if (!session) {
    return unauthorized();
  }
  try {
    const body = (await request.json()) as { source?: unknown };
    if (typeof body.source !== "string" || !body.source.trim()) {
      const t = await getTranslations("managementApi");
      return errorResponse(new Error(t("piInvalidSource")));
    }

    const result = await installPiPackage({
      source: body.source,
      userId: session.userId,
    });
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
      status: 201,
    });
  } catch (error) {
    if (error instanceof PiPackageError) {
      return piPackageErrorResponse(error);
    }
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const session = await requireManagementAdmin();
  if (!session) {
    return unauthorized();
  }
  try {
    const body = (await request.json()) as { source?: unknown };
    if (typeof body.source !== "string" || !body.source.trim()) {
      const t = await getTranslations("managementApi");
      return errorResponse(new Error(t("piInvalidSource")));
    }

    const result = await uninstallPiPackage(body.source.trim());
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof PiPackageError) {
      return piPackageErrorResponse(error);
    }
    return errorResponse(error);
  }
}
