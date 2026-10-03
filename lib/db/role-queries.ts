import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ChatbotError } from "../errors";
import {
  type AdminRole,
  type RolesView,
  SYSTEM_ROLE_CODES,
  SYSTEM_ROLE_SEEDS,
} from "../admin/roles";
import {
  department,
  type MemberRecord,
  type MemberRoleRecord,
  member,
  memberRole,
  type RoleRecord,
  role,
  user,
} from "./schema";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

export type RoleInput = {
  description: string | null;
  name: string;
};

export type MembershipChangeResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "lastAdminCannotChange"
        | "memberNotFound"
        | "roleNotFound"
        | "superAdminRequiresOne";
    };

async function wrapDatabase<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

/* ---------------------------------- 角色 ---------------------------------- */

export function listRoleRecords(): Promise<RoleRecord[]> {
  return wrapDatabase(() =>
    db.select().from(role).orderBy(asc(role.createdAt), asc(role.name))
  );
}

export function getRoleById(id: string): Promise<RoleRecord | null> {
  return wrapDatabase(async () => {
    const [selected] = await db
      .select()
      .from(role)
      .where(eq(role.id, id))
      .limit(1);
    return selected ?? null;
  });
}

export function createRoleRecord(input: RoleInput): Promise<RoleRecord> {
  return wrapDatabase(async () => {
    const [created] = await db
      .insert(role)
      .values({ ...input, type: "custom" })
      .returning();
    return created;
  });
}

export function updateRoleRecord(
  id: string,
  input: RoleInput
): Promise<RoleRecord | null> {
  return wrapDatabase(async () => {
    const [updated] = await db
      .update(role)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(role.id, id))
      .returning();
    return updated ?? null;
  });
}

export function deleteRoleRecord(id: string): Promise<boolean> {
  return wrapDatabase(async () => {
    const [deleted] = await db
      .delete(role)
      .where(eq(role.id, id))
      .returning({ id: role.id });
    return deleted !== undefined;
  });
}

/* -------------------------------- 成员关系 -------------------------------- */

function listAllMemberships(): Promise<MemberRoleRecord[]> {
  return wrapDatabase(() => db.select().from(memberRole));
}

function listMembershipsByRoleIds(
  roleIds: string[]
): Promise<MemberRoleRecord[]> {
  if (roleIds.length === 0) {
    return Promise.resolve([]);
  }
  return wrapDatabase(() =>
    db.select().from(memberRole).where(inArray(memberRole.roleId, roleIds))
  );
}

async function getSystemRoleMap(): Promise<Map<string, RoleRecord>> {
  const codes = SYSTEM_ROLE_SEEDS.map((seed) => seed.code);
  const records = await wrapDatabase(() =>
    db.select().from(role).where(inArray(role.code, codes))
  );
  return new Map(
    records
      .filter(
        (record): record is RoleRecord & { code: string } =>
          record.code !== null
      )
      .map((record) => [record.code, record])
  );
}

/**
 * 写入系统角色种子并回填成员关系（幂等，可重复调用）：
 * - 四个系统角色不存在时创建；
 * - 全部成员补进「普通成员」，Member.role 为 admin 的成员补进「管理员」；
 * - 「超级管理员」尚无人担任时，指派给最早创建的已启用管理员（无管理员时最早成员）。
 */
export async function ensureSystemRolesSeeded(): Promise<void> {
  await wrapDatabase(async () => {
    await db
      .insert(role)
      .values(
        SYSTEM_ROLE_SEEDS.map((seed) => ({
          ...seed,
          type: "system" as const,
        }))
      )
      .onConflictDoNothing({ target: role.code });

    const roleMap = await getSystemRoleMap();
    const memberRoleId = roleMap.get(SYSTEM_ROLE_CODES.member)?.id;
    const adminRoleId = roleMap.get(SYSTEM_ROLE_CODES.admin)?.id;
    const superAdminRoleId = roleMap.get(SYSTEM_ROLE_CODES.superAdmin)?.id;
    if (!memberRoleId || !adminRoleId || !superAdminRoleId) {
      return;
    }

    const members = await db
      .select({
        createdAt: member.createdAt,
        id: member.id,
        role: member.role,
        status: member.status,
      })
      .from(member)
      .orderBy(asc(member.createdAt));
    const memberIds = members.map((item) => item.id);
    const adminIds = members
      .filter((item) => item.role === "admin")
      .map((item) => item.id);

    const rows: { memberId: string; roleId: string }[] = [];
    for (const id of memberIds) {
      rows.push({ memberId: id, roleId: memberRoleId });
    }
    for (const id of adminIds) {
      rows.push({ memberId: id, roleId: adminRoleId });
    }

    const superAssignments = await db
      .select({ memberId: memberRole.memberId })
      .from(memberRole)
      .where(eq(memberRole.roleId, superAdminRoleId));
    if (superAssignments.length === 0 && members.length > 0) {
      const candidate =
        members.find(
          (item) => item.role === "admin" && item.status === "enabled"
        ) ?? members[0];
      rows.push({ memberId: candidate.id, roleId: superAdminRoleId });
      // 超级管理员具备管理员权限；兜底场景（系统还没有管理员）下补齐 admin 标记
      if (candidate.role !== "admin") {
        await db
          .update(member)
          .set({ role: "admin", updatedAt: new Date() })
          .where(eq(member.id, candidate.id));
      }
    }

    if (rows.length > 0) {
      await db.insert(memberRole).values(rows).onConflictDoNothing();
    }
  });
}

/**
 * 整体替换角色成员，并维护 Member.role 约定：
 * 成员属于「管理员」或「超级管理员」任一角色时为 admin，否则为 member。
 * 变动会导致已启用管理员数量归零时拒绝（与成员接口的「最后一名管理员」保护一致）。
 */
export async function setRoleMembership(
  roleId: string,
  memberIds: string[]
): Promise<MembershipChangeResult> {
  const target = await getRoleById(roleId);
  if (!target) {
    return { ok: false, reason: "roleNotFound" };
  }

  const uniqueIds = [...new Set(memberIds)];
  const members = await wrapDatabase(() =>
    db
      .select({
        id: member.id,
        role: member.role,
        status: member.status,
      })
      .from(member)
  );
  const memberById = new Map(members.map((item) => [item.id, item]));
  const invalid = uniqueIds.find((id) => !memberById.has(id));
  if (invalid !== undefined) {
    return { ok: false, reason: "memberNotFound" };
  }

  if (target.code === SYSTEM_ROLE_CODES.superAdmin && uniqueIds.length !== 1) {
    return { ok: false, reason: "superAdminRequiresOne" };
  }

  // 该角色的现有成员与目标成员的差异
  const existing = await listMembershipsByRoleIds([roleId]);
  const existingIds = new Set(existing.map((row) => row.memberId));
  const nextIds = new Set(uniqueIds);
  const affected = [
    ...[...nextIds].filter((id) => !existingIds.has(id)),
    ...[...existingIds].filter((id) => !nextIds.has(id)),
  ];

  // 只有「管理员 / 超级管理员」的成员变动会影响 Member.role
  const carrierCodes: string[] = [
    SYSTEM_ROLE_CODES.admin,
    SYSTEM_ROLE_CODES.superAdmin,
  ];
  const isCarrier = target.code !== null && carrierCodes.includes(target.code);

  // 预演变动后的成员角色，用于「最后一名已启用管理员」保护
  const roleOverrides = new Map<string, "admin" | "member">();
  if (isCarrier && affected.length > 0) {
    const carrierRoles = await wrapDatabase(() =>
      db
        .select({ code: role.code, memberId: memberRole.memberId })
        .from(memberRole)
        .innerJoin(role, eq(memberRole.roleId, role.id))
        .where(inArray(role.code, carrierCodes))
    );
    // 变动后具备管理员权限的成员集合：目标角色以 nextIds 为准，另一承载角色保持不变
    const adminCarrierIdsAfter = new Set(nextIds);
    for (const row of carrierRoles) {
      if (row.code !== target.code) {
        adminCarrierIdsAfter.add(row.memberId);
      }
    }

    for (const id of affected) {
      roleOverrides.set(id, adminCarrierIdsAfter.has(id) ? "admin" : "member");
    }

    const enabledAdminsAfter = members.filter(
      (item) =>
        item.status === "enabled" &&
        (roleOverrides.get(item.id) ?? item.role) === "admin"
    ).length;
    if (enabledAdminsAfter === 0) {
      return { ok: false, reason: "lastAdminCannotChange" };
    }
  }

  await wrapDatabase(() =>
    db.transaction(async (tx) => {
      const removed = [...existingIds].filter((id) => !nextIds.has(id));
      if (removed.length > 0) {
        await tx
          .delete(memberRole)
          .where(
            and(
              eq(memberRole.roleId, roleId),
              inArray(memberRole.memberId, removed)
            )
          );
      }
      const added = uniqueIds.filter((id) => !existingIds.has(id));
      if (added.length > 0) {
        await tx
          .insert(memberRole)
          .values(added.map((id) => ({ memberId: id, roleId })))
          .onConflictDoNothing();
      }
      await Promise.all(
        [...roleOverrides].map(([id, nextRole]) =>
          tx
            .update(member)
            .set({ role: nextRole, updatedAt: new Date() })
            .where(eq(member.id, id))
        )
      );
      await tx
        .update(role)
        .set({ updatedAt: new Date() })
        .where(eq(role.id, roleId));
    })
  );

  return { ok: true };
}

/** 成员是否担任超级管理员（超级管理员仅 1 人，担任即唯一） */
export function isMemberSuperAdmin(memberId: string): Promise<boolean> {
  return wrapDatabase(async () => {
    const [row] = await db
      .select({ memberId: memberRole.memberId })
      .from(memberRole)
      .innerJoin(role, eq(memberRole.roleId, role.id))
      .where(
        and(
          eq(memberRole.memberId, memberId),
          eq(role.code, SYSTEM_ROLE_CODES.superAdmin)
        )
      )
      .limit(1);
    return row !== undefined;
  });
}

/** 新建成员后的初始角色关系：进「普通成员」，管理员再进「管理员」 */
export async function attachMemberToDefaultRoles(
  memberId: string,
  legacyRole: MemberRecord["role"]
): Promise<void> {
  await ensureSystemRolesSeeded();
  const roleMap = await getSystemRoleMap();
  const memberRoleId = roleMap.get(SYSTEM_ROLE_CODES.member)?.id;
  const adminRoleId = roleMap.get(SYSTEM_ROLE_CODES.admin)?.id;
  if (!memberRoleId || !adminRoleId) {
    return;
  }

  const rows: { memberId: string; roleId: string }[] = [
    { memberId, roleId: memberRoleId },
  ];
  if (legacyRole === "admin") {
    rows.push({ memberId, roleId: adminRoleId });
  }
  await wrapDatabase(() =>
    db.insert(memberRole).values(rows).onConflictDoNothing()
  );
}

/**
 * 成员接口调整 Member.role 后同步角色关系：
 * admin ⇒ 加入「管理员」；member ⇒ 移出「管理员」与「超级管理员」。
 * 调用方需先完成「最后一名管理员」与超级管理员保护校验。
 */
export async function syncMembershipsForLegacyRole(
  memberId: string,
  nextRole: MemberRecord["role"]
): Promise<void> {
  const roleMap = await getSystemRoleMap();
  const memberRoleId = roleMap.get(SYSTEM_ROLE_CODES.member)?.id;
  const adminRoleId = roleMap.get(SYSTEM_ROLE_CODES.admin)?.id;
  const superAdminRoleId = roleMap.get(SYSTEM_ROLE_CODES.superAdmin)?.id;
  if (!memberRoleId || !adminRoleId || !superAdminRoleId) {
    return;
  }

  await wrapDatabase(() =>
    db.transaction(async (tx) => {
      if (nextRole === "admin") {
        await tx
          .insert(memberRole)
          .values({ memberId, roleId: adminRoleId })
          .onConflictDoNothing();
      } else {
        await tx
          .delete(memberRole)
          .where(
            and(
              eq(memberRole.memberId, memberId),
              inArray(memberRole.roleId, [adminRoleId, superAdminRoleId])
            )
          );
      }
      await tx
        .insert(memberRole)
        .values({ memberId, roleId: memberRoleId })
        .onConflictDoNothing();
    })
  );
}

/* ------------------------------ 页面视图组装 ------------------------------ */

function toAdminRole(
  record: RoleRecord,
  memberships: MemberRoleRecord[]
): AdminRole {
  return {
    code: record.code,
    description: record.description,
    id: record.id,
    memberIds: memberships
      .filter((row) => row.roleId === record.id)
      .map((row) => row.memberId),
    memberLimit: record.memberLimit,
    name: record.name,
    type: record.type,
  };
}

/** 单个角色的视图模型（创建 / 更新接口的返回值） */
export async function getRoleView(id: string): Promise<AdminRole | null> {
  const record = await getRoleById(id);
  if (!record) {
    return null;
  }
  const memberships = await listMembershipsByRoleIds([id]);
  return toAdminRole(record, memberships);
}

/** 角色管理页初始数据：角色列表（含成员 id）+ 成员选择器候选人 */
export async function loadRolesView(): Promise<RolesView> {
  await ensureSystemRolesSeeded();
  const [roleRecords, memberships, memberOptions] = await Promise.all([
    listRoleRecords(),
    listAllMemberships(),
    wrapDatabase(() =>
      db
        .select({
          departmentName: department.name,
          email: user.email,
          id: member.id,
          name: user.name,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .leftJoin(department, eq(member.departmentId, department.id))
        .orderBy(asc(member.createdAt))
    ),
  ]);

  return {
    members: memberOptions,
    roles: roleRecords.map((record) => toAdminRole(record, memberships)),
  };
}
