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
    return apiError("加载成员数据失败，请稍后重试", 500);
  }
}

export async function POST(request: Request) {
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
      return apiError("请输入成员姓名");
    }
    if (!email || !isValidEmail(email)) {
      return apiError("邮箱格式不正确");
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return apiError(`初始密码至少 ${MIN_PASSWORD_LENGTH} 位`);
    }
    if (!role) {
      return apiError("角色不合法");
    }

    const existingUsers = await getUser(email);
    if (existingUsers.length > 0) {
      return apiError("该邮箱已被其他成员使用", 409);
    }
    if (departmentId) {
      const departments = await listDepartments();
      if (!departments.some((item) => item.id === departmentId)) {
        return apiError("指定的部门不存在");
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
    const departments = await listDepartments();
    const departmentNames = new Map(
      departments.map((item) => [item.id, item.name])
    );
    return Response.json(serializeMember(created, departmentNames), {
      status: 201,
    });
  } catch {
    return apiError("添加成员失败，请稍后重试", 500);
  }
}

export async function PATCH(request: Request) {
  const session = await requireManagementSession();
  if (!session) {
    return unauthorized();
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.id !== "string") {
      return apiError("缺少成员 id");
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
      return apiError("请输入成员姓名");
    }
    if (!role || !status) {
      return apiError("角色或状态不合法");
    }

    const members = await listMembers();
    const target = members.find((item) => item.id === body.id);
    if (!target) {
      return apiError("成员不存在", 404);
    }

    // 不能停用当前登录的账号，避免把自己锁在管理控制台之外
    if (target.userId === session.userId && status === "disabled") {
      return apiError("不能停用当前登录的账号", 403);
    }
    // 需保留至少一名已启用的管理员
    if (
      target.role === "admin" &&
      target.status === "enabled" &&
      (role !== "admin" || status !== "enabled") &&
      !hasOtherEnabledAdmin(members, target.id)
    ) {
      return apiError(
        "需保留至少一名已启用的管理员，无法降级或停用该成员",
        409
      );
    }

    if (departmentId) {
      const departments = await listDepartments();
      if (!departments.some((item) => item.id === departmentId)) {
        return apiError("指定的部门不存在");
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
      return apiError("成员不存在", 404);
    }
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
    return apiError("更新成员失败，请稍后重试", 500);
  }
}

export async function DELETE(request: Request) {
  const session = await requireManagementSession();
  if (!session) {
    return unauthorized();
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.id !== "string") {
      return apiError("缺少成员 id");
    }

    const members = await listMembers();
    const target = members.find((item) => item.id === body.id);
    if (!target) {
      return apiError("成员不存在", 404);
    }
    if (target.userId === session.userId) {
      return apiError("不能删除当前登录的账号", 403);
    }
    if (
      target.role === "admin" &&
      target.status === "enabled" &&
      !hasOtherEnabledAdmin(members, target.id)
    ) {
      return apiError("需保留至少一名已启用的管理员，无法删除该成员", 409);
    }

    await deleteMemberAccount(target.id);
    return Response.json({ deleted: true });
  } catch {
    return apiError("删除成员失败，请稍后重试", 500);
  }
}
