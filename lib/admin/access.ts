import "server-only";

import { auth } from "@/app/(auth)/auth";
import { getMemberByUserId } from "@/lib/db/organization-queries";
import { getUserById } from "@/lib/db/queries";

export type AdminSession = {
  /** 当前登录账号（User 表）id */
  userId: string;
};

/**
 * 管理接口的会话校验：需为已登录的正式账号（非访客），
 * 且对应成员未被停用；旧账号无成员记录时视为可用。
 */
export async function requireAdminSession(): Promise<AdminSession | null> {
  const session = await auth();
  if (session?.user?.type !== "regular" || !session.user.id) {
    return null;
  }

  const memberRecord = await getMemberByUserId(session.user.id);
  if (memberRecord && memberRecord.status === "disabled") {
    return null;
  }

  return { userId: session.user.id };
}

/** Skill 等高权限管理操作仅允许已启用管理员；旧账号无成员记录时兼容放行。 */
export async function requireAdminRole(): Promise<AdminSession | null> {
  const session = await auth();
  if (session?.user?.type !== "regular" || !session.user.id) {
    return null;
  }

  const [userRecord, memberRecord] = await Promise.all([
    getUserById(session.user.id),
    getMemberByUserId(session.user.id),
  ]);
  if (!userRecord) {
    return null;
  }
  if (
    memberRecord &&
    (memberRecord.role !== "admin" || memberRecord.status !== "enabled")
  ) {
    return null;
  }

  return { userId: session.user.id };
}
