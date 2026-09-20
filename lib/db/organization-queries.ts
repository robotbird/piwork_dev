import "server-only";

import { asc, count, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ChatbotError } from "../errors";
import type { ManagementMember } from "../management/members";
import type { Department, MemberSummary } from "../management/organization";
import { getUserById } from "./queries";
import {
  chat,
  type DepartmentRecord,
  department,
  document,
  type MemberRecord,
  member,
  message,
  stream,
  suggestion,
  type User,
  user,
  vote,
} from "./schema";
import { generateHashedPassword } from "./utils";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

export type MemberWithUser = {
  createdAt: Date;
  departmentId: string | null;
  email: string;
  id: string;
  name: string | null;
  role: MemberRecord["role"];
  status: MemberRecord["status"];
  title: string | null;
  userId: string;
};

export type DepartmentInput = {
  leaderId: string | null;
  name: string;
  parentId: string | null;
};

export type MemberAccountInput = {
  departmentId: string | null;
  email: string;
  name: string;
  password: string;
  role: MemberRecord["role"];
  title: string | null;
};

export type MemberUpdateInput = {
  departmentId: string | null;
  id: string;
  name: string;
  role: MemberRecord["role"];
  status: MemberRecord["status"];
  title: string | null;
};

export type DepartmentOption = {
  id: string;
  name: string;
};

export type OrganizationView = {
  departments: Department[];
  members: MemberSummary[];
};

export type MembersView = {
  departments: DepartmentOption[];
  members: ManagementMember[];
};

async function wrapDatabase<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

/* ---------------------------------- 成员 ---------------------------------- */

export function listMembers(): Promise<MemberWithUser[]> {
  return wrapDatabase(() =>
    db
      .select({
        createdAt: member.createdAt,
        departmentId: member.departmentId,
        email: user.email,
        id: member.id,
        name: user.name,
        role: member.role,
        status: member.status,
        title: member.title,
        userId: member.userId,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .orderBy(asc(member.createdAt))
  );
}

export function getMemberByUserId(
  userId: string
): Promise<MemberRecord | null> {
  return wrapDatabase(async () => {
    const [selected] = await db
      .select()
      .from(member)
      .where(eq(member.userId, userId))
      .limit(1);
    return selected ?? null;
  });
}

export function countEnabledAdmins(): Promise<number> {
  return wrapDatabase(async () => {
    const [row] = await db
      .select({ value: count() })
      .from(member)
      .where(eq(member.role, "admin"));
    return row?.value ?? 0;
  });
}

/** 创建成员：同一事务内创建登录账号与成员记录，成员即可用邮箱登录 */
export function createMemberWithAccount(
  input: MemberAccountInput
): Promise<MemberWithUser> {
  const hashedPassword = generateHashedPassword(input.password);

  return wrapDatabase(() =>
    db.transaction(async (tx) => {
      const [createdUser] = await tx
        .insert(user)
        .values({
          email: input.email,
          name: input.name,
          password: hashedPassword,
        })
        .returning({ email: user.email, id: user.id, name: user.name });

      const [createdMember] = await tx
        .insert(member)
        .values({
          departmentId: input.departmentId,
          role: input.role,
          title: input.title,
          userId: createdUser.id,
        })
        .returning();

      return {
        createdAt: createdMember.createdAt,
        departmentId: createdMember.departmentId,
        email: createdUser.email,
        id: createdMember.id,
        name: createdUser.name,
        role: createdMember.role,
        status: createdMember.status,
        title: createdMember.title,
        userId: createdMember.userId,
      };
    })
  );
}

export function updateMemberRecord(
  input: MemberUpdateInput
): Promise<MemberRecord | null> {
  return wrapDatabase(() =>
    db.transaction(async (tx) => {
      const [target] = await tx
        .select({ userId: member.userId })
        .from(member)
        .where(eq(member.id, input.id))
        .limit(1);
      if (!target) {
        return null;
      }

      await tx
        .update(user)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(user.id, target.userId));

      const [updated] = await tx
        .update(member)
        .set({
          departmentId: input.departmentId,
          role: input.role,
          status: input.status,
          title: input.title,
          updatedAt: new Date(),
        })
        .where(eq(member.id, input.id))
        .returning();
      return updated ?? null;
    })
  );
}

/**
 * 删除成员：连同登录账号与其名下的会话、文档等数据一并移除。
 * 依赖外键级联删除 Member（userId cascade）；聊天等表没有级联，需先手动清理。
 */
export async function deleteMemberAccount(memberId: string): Promise<void> {
  await wrapDatabase(() =>
    db.transaction(async (tx) => {
      const [target] = await tx
        .select({ id: member.id, userId: member.userId })
        .from(member)
        .where(eq(member.id, memberId))
        .limit(1);
      if (!target) {
        return;
      }

      const chats = await tx
        .select({ id: chat.id })
        .from(chat)
        .where(eq(chat.userId, target.userId));
      const chatIds = chats.map((row) => row.id);
      if (chatIds.length > 0) {
        await tx.delete(vote).where(inArray(vote.chatId, chatIds));
        await tx.delete(message).where(inArray(message.chatId, chatIds));
        await tx.delete(stream).where(inArray(stream.chatId, chatIds));
      }
      await tx.delete(chat).where(eq(chat.userId, target.userId));
      await tx.delete(suggestion).where(eq(suggestion.userId, target.userId));
      await tx.delete(document).where(eq(document.userId, target.userId));
      // 负责人指向该成员的部门先置空负责人（不依赖级联时序，语义更明确）
      await tx
        .update(department)
        .set({ leaderId: null, updatedAt: new Date() })
        .where(eq(department.leaderId, target.id));
      // Member 记录随账号级联删除
      await tx.delete(user).where(eq(user.id, target.userId));
    })
  );
}

/* ---------------------------------- 部门 ---------------------------------- */

export function listDepartments(): Promise<DepartmentRecord[]> {
  return wrapDatabase(() =>
    db.select().from(department).orderBy(asc(department.createdAt))
  );
}

export function getDepartmentById(
  id: string
): Promise<DepartmentRecord | null> {
  return wrapDatabase(async () => {
    const [selected] = await db
      .select()
      .from(department)
      .where(eq(department.id, id))
      .limit(1);
    return selected ?? null;
  });
}

export function countChildDepartments(id: string): Promise<number> {
  return wrapDatabase(async () => {
    const [row] = await db
      .select({ value: count() })
      .from(department)
      .where(eq(department.parentId, id));
    return row?.value ?? 0;
  });
}

export function createDepartmentRecord(
  input: DepartmentInput
): Promise<DepartmentRecord> {
  return wrapDatabase(async () => {
    const [created] = await db.insert(department).values(input).returning();
    return created;
  });
}

export function updateDepartmentRecord(
  id: string,
  input: DepartmentInput
): Promise<DepartmentRecord | null> {
  return wrapDatabase(async () => {
    const [updated] = await db
      .update(department)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(department.id, id))
      .returning();
    return updated ?? null;
  });
}

/** 删除部门：直属成员与下级部门由外键置空 / 提升，不在此处级联删除数据 */
export function deleteDepartmentRecord(id: string): Promise<boolean> {
  return wrapDatabase(async () => {
    const [deleted] = await db
      .delete(department)
      .where(eq(department.id, id))
      .returning({ id: department.id });
    return deleted !== undefined;
  });
}

/* -------------------------------- 登录补建 -------------------------------- */

/**
 * 为登录账号补建成员记录：功能上线前的旧账号没有 Member 行，首次登录时补齐，
 * 保证成员管理覆盖全部可登录账号。系统内还没有已启用的管理员时，该成员成为管理员。
 */
export async function ensureMemberForUser(
  userRecord: User
): Promise<MemberRecord | null> {
  if (userRecord.isAnonymous) {
    return null;
  }

  const existing = await getMemberByUserId(userRecord.id);
  if (existing) {
    return existing;
  }

  const adminCount = await countEnabledAdmins();
  const role = adminCount === 0 ? "admin" : "member";

  return wrapDatabase(async () => {
    const [created] = await db
      .insert(member)
      .values({ role, userId: userRecord.id })
      .onConflictDoNothing({ target: member.userId })
      .returning();
    // 并发登录触发唯一约束时回读已存在的记录
    return created ?? (await getMemberByUserId(userRecord.id));
  });
}

/**
 * 按用户 id 补建成员记录：成员功能上线前签发的旧会话（JWT 一直有效）不会重新走登录流程，
 * 登录时的补建不会触发；管理页面加载数据前调用此方法兜底，保证成员列表覆盖当前登录账号。
 */
export async function ensureMemberForUserId(
  userId: string
): Promise<MemberRecord | null> {
  const userRecord = await getUserById(userId);
  if (!userRecord) {
    return null;
  }
  return ensureMemberForUser(userRecord);
}

/* ------------------------------ 页面视图组装 ------------------------------ */

function toMemberSummary(item: MemberWithUser): MemberSummary {
  return {
    departmentId: item.departmentId,
    email: item.email,
    id: item.id,
    name: item.name,
    title: item.title,
  };
}

function toDepartment(record: DepartmentRecord): Department {
  return {
    id: record.id,
    leaderId: record.leaderId,
    name: record.name,
    parentId: record.parentId,
  };
}

function toManagementMember(
  item: MemberWithUser,
  departmentNames: Map<string, string>
): ManagementMember {
  return {
    addedAt: item.createdAt.toISOString(),
    departmentId: item.departmentId,
    departmentName: item.departmentId
      ? (departmentNames.get(item.departmentId) ?? null)
      : null,
    email: item.email,
    id: item.id,
    name: item.name,
    role: item.role,
    status: item.status,
    title: item.title,
    userId: item.userId,
  };
}

/** 组织架构页初始数据：部门树 + 成员概要（徽章计数、负责人、成员卡片） */
export async function loadOrganizationView(): Promise<OrganizationView> {
  const [departments, members] = await Promise.all([
    listDepartments(),
    listMembers(),
  ]);
  return {
    departments: departments.map(toDepartment),
    members: members.map(toMemberSummary),
  };
}

/** 成员管理页初始数据：成员列表 + 部门选项 */
export async function loadMembersView(): Promise<MembersView> {
  const [members, departments] = await Promise.all([
    listMembers(),
    listDepartments(),
  ]);
  const departmentNames = new Map(
    departments.map((item) => [item.id, item.name])
  );
  return {
    departments: departments.map((item) => ({
      id: item.id,
      name: item.name,
    })),
    members: members.map((item) => toManagementMember(item, departmentNames)),
  };
}
