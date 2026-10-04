import "server-only";

import { auth } from "@/app/(auth)/auth";
import { getMemberByUserId } from "@/lib/db/organization-queries";
import { getUserById } from "@/lib/db/queries";

export type AdminSession = { userId: string };

/** All management endpoints require an enabled administrator. */
export function requireAdminSession(): Promise<AdminSession | null> {
  return requireAdminRole();
}

/** 管理操作仅允许有正式成员记录的已启用管理员。 */
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
  if (memberRecord?.role !== "admin" || memberRecord.status !== "enabled") {
    return null;
  }

  return { userId: session.user.id };
}
