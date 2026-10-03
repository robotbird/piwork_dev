import { getTranslations } from "next-intl/server";

import { ChatbotError } from "@/lib/errors";
import { requireAdminRole } from "@/lib/admin/access";
import { searchPiPackageCatalog } from "@/lib/pi-packages/catalog";

/** npm pi-package 目录搜索代理(pi.dev/packages 同源);仅管理员可用。 */
export async function GET(request: Request) {
  const session = await requireAdminRole();
  if (!session) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const rawOffset = Number(searchParams.get("offset") ?? "0");
  const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  try {
    const result = await searchPiPackageCatalog(query, offset);
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const t = await getTranslations("adminApi");
    return Response.json(
      {
        detail: error instanceof Error ? error.message : undefined,
        error: t("piCatalogFailed"),
      },
      { status: 502 }
    );
  }
}
