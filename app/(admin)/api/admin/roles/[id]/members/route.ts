import { getTranslations } from "next-intl/server";
import { getRoleView, setRoleMembership } from "@/lib/db/role-queries";
import { ChatbotError } from "@/lib/errors";
import { requireAdminSession } from "@/lib/admin/access";

function apiError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/** 整体替换角色成员；「管理员 / 超级管理员」的变动会同步成员的管理员权限 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations("adminApi");
  const session = await requireAdminSession();
  if (!session) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    if (
      !Array.isArray(body.memberIds) ||
      body.memberIds.some((item) => typeof item !== "string")
    ) {
      return apiError(t("memberIdListRequired"));
    }

    const result = await setRoleMembership(id, body.memberIds as string[]);
    if (!result.ok) {
      const statusByReason: Record<typeof result.reason, number> = {
        lastAdminCannotChange: 409,
        memberNotFound: 400,
        roleNotFound: 404,
        superAdminRequiresOne: 409,
      };
      return apiError(t(result.reason), statusByReason[result.reason]);
    }

    return Response.json(await getRoleView(id));
  } catch {
    return apiError(t("updateRoleMembersFailed"), 500);
  }
}
