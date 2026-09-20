import {
  countChildDepartments,
  createDepartmentRecord,
  deleteDepartmentRecord,
  getDepartmentById,
  listDepartments,
  listMembers,
  loadOrganizationView,
  updateDepartmentRecord,
} from "@/lib/db/organization-queries";
import { ChatbotError } from "@/lib/errors";
import { requireManagementSession } from "@/lib/management/access";
import type { Department, MemberSummary } from "@/lib/management/organization";
import { getDescendantIds } from "@/lib/management/organization";

const MAX_DEPARTMENT_NAME_LENGTH = 128;

function apiError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function unauthorized() {
  return new ChatbotError("unauthorized:chat").toResponse();
}

function parseDepartmentInput(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const parentId = typeof body.parentId === "string" ? body.parentId : null;
  const leaderId = typeof body.leaderId === "string" ? body.leaderId : null;
  return { leaderId, name, parentId };
}

/** 拉平后的部门列表（用于重名与环检测） */
async function loadDepartmentIndex() {
  const [departments, members] = await Promise.all([
    listDepartments(),
    listMembers(),
  ]);
  const memberIds = new Set(members.map((item) => item.id));
  const memberSummaries: MemberSummary[] = members.map((item) => ({
    departmentId: item.departmentId,
    email: item.email,
    id: item.id,
    name: item.name,
    title: item.title,
  }));
  return { departments, memberIds, memberSummaries };
}

function serializeDepartment(record: {
  id: string;
  leaderId: string | null;
  name: string;
  parentId: string | null;
}): Department {
  return {
    id: record.id,
    leaderId: record.leaderId,
    name: record.name,
    parentId: record.parentId,
  };
}

export async function GET() {
  const session = await requireManagementSession();
  if (!session) {
    return unauthorized();
  }

  try {
    const view = await loadOrganizationView();
    return Response.json(view, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return apiError("加载组织架构数据失败，请稍后重试", 500);
  }
}

export async function POST(request: Request) {
  const session = await requireManagementSession();
  if (!session) {
    return unauthorized();
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const input = parseDepartmentInput(body);

    if (!input.name) {
      return apiError("请输入部门名称");
    }
    if (input.name.length > MAX_DEPARTMENT_NAME_LENGTH) {
      return apiError("部门名称过长");
    }

    const { departments, memberIds } = await loadDepartmentIndex();

    if (
      input.parentId &&
      !departments.some((item) => item.id === input.parentId)
    ) {
      return apiError("指定的上级部门不存在");
    }
    if (input.leaderId && !memberIds.has(input.leaderId)) {
      return apiError("部门负责人必须是已有成员");
    }
    const duplicated = departments.some(
      (item) => item.parentId === input.parentId && item.name === input.name
    );
    if (duplicated) {
      return apiError("同一上级部门下已存在同名部门", 409);
    }

    const created = await createDepartmentRecord(input);
    return Response.json(serializeDepartment(created), { status: 201 });
  } catch {
    return apiError("创建部门失败，请稍后重试", 500);
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
      return apiError("缺少部门 id");
    }
    const input = parseDepartmentInput(body);

    if (!input.name) {
      return apiError("请输入部门名称");
    }
    if (input.name.length > MAX_DEPARTMENT_NAME_LENGTH) {
      return apiError("部门名称过长");
    }

    const existing = await getDepartmentById(body.id);
    if (!existing) {
      return apiError("部门不存在", 404);
    }

    const { departments, memberIds } = await loadDepartmentIndex();

    if (
      input.parentId &&
      !departments.some((item) => item.id === input.parentId)
    ) {
      return apiError("指定的上级部门不存在");
    }
    if (input.leaderId && !memberIds.has(input.leaderId)) {
      return apiError("部门负责人必须是已有成员");
    }
    // 顶级组织不支持调整上级，保证始终存在顶层的根部门
    if (existing.parentId === null && input.parentId !== null) {
      return apiError("顶级组织不支持调整上级部门");
    }
    if (
      input.parentId &&
      (input.parentId === existing.id ||
        getDescendantIds(departments.map(serializeDepartment), existing.id).has(
          input.parentId
        ))
    ) {
      return apiError("上级部门不能是自身或其下级部门");
    }
    const duplicated = departments.some(
      (item) =>
        item.id !== existing.id &&
        item.parentId === input.parentId &&
        item.name === input.name
    );
    if (duplicated) {
      return apiError("同一上级部门下已存在同名部门", 409);
    }

    const updated = await updateDepartmentRecord(existing.id, input);
    if (!updated) {
      return apiError("部门不存在", 404);
    }
    return Response.json(serializeDepartment(updated));
  } catch {
    return apiError("更新部门失败，请稍后重试", 500);
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
      return apiError("缺少部门 id");
    }

    const existing = await getDepartmentById(body.id);
    if (!existing) {
      return apiError("部门不存在", 404);
    }

    const childCount = await countChildDepartments(existing.id);
    if (childCount > 0) {
      return apiError("该部门下还有下级部门，需先删除或转移下级部门", 409);
    }

    await deleteDepartmentRecord(existing.id);
    return Response.json({ deleted: true });
  } catch {
    return apiError("删除部门失败，请稍后重试", 500);
  }
}
