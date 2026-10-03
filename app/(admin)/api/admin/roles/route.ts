import { getTranslations } from "next-intl/server";
import {
  createRoleRecord,
  deleteRoleRecord,
  getRoleById,
  getRoleView,
  listRoleRecords,
  loadRolesView,
  updateRoleRecord,
} from "@/lib/db/role-queries";
import { ChatbotError } from "@/lib/errors";
import { requireAdminSession } from "@/lib/admin/access";
import {
  ROLE_DESCRIPTION_MAX_LENGTH,
  ROLE_NAME_MAX_LENGTH,
} from "@/lib/admin/roles";

function apiError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function unauthorized() {
  return new ChatbotError("unauthorized:chat").toResponse();
}

/** 解析并校验名称与描述；errorCode 由调用方翻译为接口消息 */
function parseRoleInput(
  body: Record<string, unknown>
): { errorCode: string } | { description: string | null; name: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : null;

  if (!name) {
    return { errorCode: "roleNameRequired" };
  }
  if (name.length > ROLE_NAME_MAX_LENGTH) {
    return { errorCode: "roleNameTooLong" };
  }
  if (description && description.length > ROLE_DESCRIPTION_MAX_LENGTH) {
    return { errorCode: "roleDescriptionTooLong" };
  }
  return { description, name };
}

export async function GET() {
  const t = await getTranslations("adminApi");
  const session = await requireAdminSession();
  if (!session) {
    return unauthorized();
  }

  try {
    const view = await loadRolesView();
    return Response.json(view, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return apiError(t("loadRolesFailed"), 500);
  }
}

export async function POST(request: Request) {
  const t = await getTranslations("adminApi");
  const session = await requireAdminSession();
  if (!session) {
    return unauthorized();
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parseRoleInput(body);
    if ("errorCode" in parsed) {
      return apiError(t(parsed.errorCode));
    }

    const roles = await listRoleRecords();
    if (roles.some((item) => item.name === parsed.name)) {
      return apiError(t("duplicateRole"), 409);
    }

    const created = await createRoleRecord({
      description: parsed.description,
      name: parsed.name,
    });
    return Response.json(await getRoleView(created.id), { status: 201 });
  } catch {
    return apiError(t("createRoleFailed"), 500);
  }
}

export async function PATCH(request: Request) {
  const t = await getTranslations("adminApi");
  const session = await requireAdminSession();
  if (!session) {
    return unauthorized();
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.id !== "string") {
      return apiError(t("roleIdRequired"));
    }
    const parsed = parseRoleInput(body);
    if ("errorCode" in parsed) {
      return apiError(t(parsed.errorCode));
    }

    const target = await getRoleById(body.id);
    if (!target) {
      return apiError(t("roleNotFound"), 404);
    }
    if (target.type === "system") {
      return apiError(t("systemRoleLocked"), 403);
    }

    const roles = await listRoleRecords();
    if (
      roles.some((item) => item.id !== target.id && item.name === parsed.name)
    ) {
      return apiError(t("duplicateRole"), 409);
    }

    const updated = await updateRoleRecord(target.id, {
      description: parsed.description,
      name: parsed.name,
    });
    if (!updated) {
      return apiError(t("roleNotFound"), 404);
    }
    return Response.json(await getRoleView(target.id));
  } catch {
    return apiError(t("updateRoleFailed"), 500);
  }
}

export async function DELETE(request: Request) {
  const t = await getTranslations("adminApi");
  const session = await requireAdminSession();
  if (!session) {
    return unauthorized();
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.id !== "string") {
      return apiError(t("roleIdRequired"));
    }

    const target = await getRoleById(body.id);
    if (!target) {
      return apiError(t("roleNotFound"), 404);
    }
    if (target.type === "system") {
      return apiError(t("systemRoleLocked"), 403);
    }

    await deleteRoleRecord(target.id);
    return Response.json({ deleted: true });
  } catch {
    return apiError(t("deleteRoleFailed"), 500);
  }
}
