import { getTranslations } from "next-intl/server";
import {
  createMemberWithAccount,
  deleteMemberAccount,
  listDepartments,
  listMembers,
  loadMembersView,
  type MemberWithUser,
  updateMemberRecord,
} from "@/lib/db/organization-queries";
import { getUser } from "@/lib/db/queries";
import {
  attachMemberToDefaultRoles,
  isMemberSuperAdmin,
  syncMembershipsForLegacyRole,
} from "@/lib/db/role-queries";
import { ChatbotError } from "@/lib/errors";
import { requireManagementSession } from "@/lib/management/access";
import type { ManagementMember } from "@/lib/management/members";
import { isValidEmail } from "@/lib/management/members";

const MIN_PASSWORD_LENGTH = 6;

function apiError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function unauthorized() {
  return new ChatbotError("unauthorized:chat").toResponse();
}

function serializeMember(
  memberRecord: MemberWithUser,
  departmentNames: Map<string, string>
): ManagementMember {
  return {
    addedAt: memberRecord.createdAt.toISOString(),
    departmentId: memberRecord.departmentId,
    departmentName: memberRecord.departmentId
      ? (departmentNames.get(memberRecord.departmentId) ?? null)
      : null,
    email: memberRecord.email,
    id: memberRecord.id,
    name: memberRecord.name,
    role: memberRecord.role,
    status: memberRecord.status,
    title: memberRecord.title,
    userId: memberRecord.userId,
  };
}

/** 是否存在除目标外的其他已启用管理员（用于「最后一名管理员」保护） */
function hasOtherEnabledAdmin(
  members: readonly MemberWithUser[],
  targetId: string
): boolean {
  return members.some(
    (item) =>
      item.id !== targetId && item.role === "admin" && item.status === "enabled"
  );
}

function parseRole(value: unknown): "admin" | "member" | null {
  return value === "admin" || value === "member" ? value : null;
}

function parseStatus(value: unknown): "enabled" | "disabled" | null {
  return value === "enabled" || value === "disabled" ? value : null;
}

export async function GET() {
  const t = await getTranslations("managementApi");
  const session = await requireManagementSession();
  if (!session) {
    return unauthorized();
  }

  try {
    const view = await loadMembersView();
    return Response.json(view, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return apiError(t("loadMembersFailed"), 500);
  }
}

export async function POST(request: Request) {
  const t = await getTranslations("managementApi");
  const session = await requireManagementSession();
  if (!session) {
    return unauthorized();
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : null;
    const departmentId =
      typeof body.departmentId === "string" && body.departmentId
        ? body.departmentId
        : null;
    const role = parseRole(body.role);

    if (!name) {
      return apiError(t("memberNameRequired"));
    }
    if (!email || !isValidEmail(email)) {
      return apiError(t("invalidEmail"));
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return apiError(t("passwordTooShort", { count: MIN_PASSWORD_LENGTH }));
    }
    if (!role) {
      return apiError(t("invalidRole"));
    }

    const existingUsers = await getUser(email);
    if (existingUsers.length > 0) {
      return apiError(t("emailInUse"), 409);
    }
    if (departmentId) {
      const departments = await listDepartments();
      if (!departments.some((item) => item.id === departmentId)) {
        return apiError(t("departmentNotFound"));
      }
    }

    const created = await createMemberWithAccount({
      departmentId,
      email,
      name,
      password,
      role,
      title,
    });
    // 同步初始角色关系：普通成员进「普通成员」，管理员再进「管理员」
    await attachMemberToDefaultRoles(created.id, role);
    const departments = await listDepartments();
    const departmentNames = new Map(
      departments.map((item) => [item.id, item.name])
    );
    return Response.json(serializeMember(created, departmentNames), {
      status: 201,
    });
  } catch {
    return apiError(t("addMemberFailed"), 500);
  }
}

export async function PATCH(request: Request) {
  const t = await getTranslations("managementApi");
  const session = await requireManagementSession();
  if (!session) {
    return unauthorized();
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.id !== "string") {
      return apiError(t("memberIdRequired"));
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : null;
    const departmentId =
      typeof body.departmentId === "string" && body.departmentId
        ? body.departmentId
        : null;
    const role = parseRole(body.role);
    const status = parseStatus(body.status);

    if (!name) {
      return apiError(t("memberNameRequired"));
    }
    if (!role || !status) {
      return apiError(t("invalidRoleOrStatus"));
    }

    const members = await listMembers();
    const target = members.find((item) => item.id === body.id);
    if (!target) {
      return apiError(t("memberNotFound"), 404);
    }

    // 不能停用当前登录的账号，避免把自己锁在管理控制台之外
    if (target.userId === session.userId && status === "disabled") {
      return apiError(t("cannotDisableSelf"), 403);
    }
    // 超级管理员的担任关系由「角色与权限」页管理，先转移超级管理员再降级
    if (role !== "admin" && (await isMemberSuperAdmin(target.id))) {
      return apiError(t("cannotDemoteSuperAdmin"), 409);
    }
    // 需保留至少一名已启用的管理员
    if (
      target.role === "admin" &&
      target.status === "enabled" &&
      (role !== "admin" || status !== "enabled") &&
      !hasOtherEnabledAdmin(members, target.id)
    ) {
      return apiError(t("lastAdminCannotChange"), 409);
    }

    if (departmentId) {
      const departments = await listDepartments();
      if (!departments.some((item) => item.id === departmentId)) {
        return apiError(t("departmentNotFound"));
      }
    }

    const updated = await updateMemberRecord({
      departmentId,
      id: target.id,
      name,
      role,
      status,
      title,
    });
    if (!updated) {
      return apiError(t("memberNotFound"), 404);
    }
    // 同步角色关系，保证「管理员 / 超级管理员」成员关系与 Member.role 一致
    await syncMembershipsForLegacyRole(target.id, role);
    const departments = await listDepartments();
    const departmentNames = new Map(
      departments.map((item) => [item.id, item.name])
    );
    return Response.json(
      serializeMember(
        {
          ...target,
          departmentId: updated.departmentId,
          role: updated.role,
          status: updated.status,
          title: updated.title,
        },
        departmentNames
      )
    );
  } catch {
    return apiError(t("updateMemberFailed"), 500);
  }
}

export async function DELETE(request: Request) {
  const t = await getTranslations("managementApi");
  const session = await requireManagementSession();
  if (!session) {
    return unauthorized();
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.id !== "string") {
      return apiError(t("memberIdRequired"));
    }

    const members = await listMembers();
    const target = members.find((item) => item.id === body.id);
    if (!target) {
      return apiError(t("memberNotFound"), 404);
    }
    if (target.userId === session.userId) {
      return apiError(t("cannotDeleteSelf"), 403);
    }
    // 超级管理员仅 1 人，删除前需先在「角色与权限」页转移给其他成员
    if (await isMemberSuperAdmin(target.id)) {
      return apiError(t("transferSuperAdminFirst"), 409);
    }
    if (
      target.role === "admin" &&
      target.status === "enabled" &&
      !hasOtherEnabledAdmin(members, target.id)
    ) {
      return apiError(t("lastAdminCannotDelete"), 409);
    }

    await deleteMemberAccount(target.id);
    return Response.json({ deleted: true });
  } catch {
    return apiError(t("deleteMemberFailed"), 500);
  }
}
