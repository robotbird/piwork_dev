import { getTranslations } from "next-intl/server";
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
import { requireAdminSession } from "@/lib/admin/access";
import type { Department, MemberSummary } from "@/lib/admin/organization";
import { getDescendantIds } from "@/lib/admin/organization";

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
  const t = await getTranslations("adminApi");
  const session = await requireAdminSession();
  if (!session) {
    return unauthorized();
  }

  try {
    const view = await loadOrganizationView();
    return Response.json(view, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return apiError(t("loadOrganizationFailed"), 500);
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
    const input = parseDepartmentInput(body);

    if (!input.name) {
      return apiError(t("departmentNameRequired"));
    }
    if (input.name.length > MAX_DEPARTMENT_NAME_LENGTH) {
      return apiError(t("departmentNameTooLong"));
    }

    const { departments, memberIds } = await loadDepartmentIndex();

    if (
      input.parentId &&
      !departments.some((item) => item.id === input.parentId)
    ) {
      return apiError(t("parentNotFound"));
    }
    if (input.leaderId && !memberIds.has(input.leaderId)) {
      return apiError(t("leaderNotFound"));
    }
    const duplicated = departments.some(
      (item) => item.parentId === input.parentId && item.name === input.name
    );
    if (duplicated) {
      return apiError(t("duplicateDepartment"), 409);
    }

    const created = await createDepartmentRecord(input);
    return Response.json(serializeDepartment(created), { status: 201 });
  } catch {
    return apiError(t("createDepartmentFailed"), 500);
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
      return apiError(t("departmentIdRequired"));
    }
    const input = parseDepartmentInput(body);

    if (!input.name) {
      return apiError(t("departmentNameRequired"));
    }
    if (input.name.length > MAX_DEPARTMENT_NAME_LENGTH) {
      return apiError(t("departmentNameTooLong"));
    }

    const existing = await getDepartmentById(body.id);
    if (!existing) {
      return apiError(t("departmentRecordNotFound"), 404);
    }

    const { departments, memberIds } = await loadDepartmentIndex();

    if (
      input.parentId &&
      !departments.some((item) => item.id === input.parentId)
    ) {
      return apiError(t("parentNotFound"));
    }
    if (input.leaderId && !memberIds.has(input.leaderId)) {
      return apiError(t("leaderNotFound"));
    }
    // 顶级组织不支持调整上级，保证始终存在顶层的根部门
    if (existing.parentId === null && input.parentId !== null) {
      return apiError(t("rootParentLocked"));
    }
    if (
      input.parentId &&
      (input.parentId === existing.id ||
        getDescendantIds(departments.map(serializeDepartment), existing.id).has(
          input.parentId
        ))
    ) {
      return apiError(t("invalidParent"));
    }
    const duplicated = departments.some(
      (item) =>
        item.id !== existing.id &&
        item.parentId === input.parentId &&
        item.name === input.name
    );
    if (duplicated) {
      return apiError(t("duplicateDepartment"), 409);
    }

    const updated = await updateDepartmentRecord(existing.id, input);
    if (!updated) {
      return apiError(t("departmentRecordNotFound"), 404);
    }
    return Response.json(serializeDepartment(updated));
  } catch {
    return apiError(t("updateDepartmentFailed"), 500);
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
      return apiError(t("departmentIdRequired"));
    }

    const existing = await getDepartmentById(body.id);
    if (!existing) {
      return apiError(t("departmentRecordNotFound"), 404);
    }

    const childCount = await countChildDepartments(existing.id);
    if (childCount > 0) {
      return apiError(t("departmentHasChildren"), 409);
    }

    await deleteDepartmentRecord(existing.id);
    return Response.json({ deleted: true });
  } catch {
    return apiError(t("deleteDepartmentFailed"), 500);
  }
}
