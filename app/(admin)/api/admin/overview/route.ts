import { getTranslations } from "next-intl/server";
import { requireAdminRole } from "@/lib/admin/access";
import { getAdminOverview } from "@/lib/admin/overview";
import { ChatbotError } from "@/lib/errors";

/** 管理端概览数据（只读）；仅管理员可用 */
export async function GET() {
  const session = await requireAdminRole();
  if (!session) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }
  const t = await getTranslations("adminApi");
  try {
    const overview = await getAdminOverview();
    return Response.json(overview, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[admin/overview] failed to assemble overview", error);
    return Response.json({ error: t("overviewLoadFailed") }, { status: 500 });
  }
}
