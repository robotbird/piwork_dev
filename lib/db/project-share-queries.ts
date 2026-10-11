import "server-only";
import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";
import {
  type CreateShareInviteResult,
  generateShareToken,
  hashShareToken,
  type ChatParticipant as ProjectParticipant,
  projectUserAvatar,
  SHARE_INVITE_TTL_DAYS,
  type ShareInviteSummary,
  sameShareTokenHash,
} from "./chat-share-queries";
import { getDb } from "./client";
import {
  member,
  type Project,
  type ProjectShareInviteRecord,
  project,
  projectCollaborator,
  projectShareInvite,
  user,
} from "./schema";

const db = getDb();
type ProjectAccess = {
  project: Project;
  isOwner: boolean;
  isCollaborator: boolean;
};
type ShareInviteCheck = { projectId: string; invite: ProjectShareInviteRecord };
export async function getProjectAccess(
  projectId: string,
  userId: string
): Promise<ProjectAccess | null> {
  const [row] = await db
    .select({
      collaboratorUserId: projectCollaborator.userId,
      memberStatus: member.status,
      project,
    })
    .from(project)
    .leftJoin(
      projectCollaborator,
      and(
        eq(projectCollaborator.projectId, project.id),
        eq(projectCollaborator.userId, userId)
      )
    )
    .leftJoin(member, eq(member.userId, projectCollaborator.userId))
    .where(eq(project.id, projectId))
    .limit(1);

  if (!row) {
    return null;
  }

  if (
    row.project.userId !== userId &&
    (row.collaboratorUserId !== userId || row.memberStatus !== "enabled")
  ) {
    return null;
  }
  return {
    isCollaborator: row.collaboratorUserId === userId,
    isOwner: row.project.userId === userId,
    project: row.project,
  };
}

export async function listProjectCollaborators(
  projectId: string
): Promise<ProjectParticipant[]> {
  const rows = await db
    .select({
      image: user.image,
      invitedBy: projectCollaborator.invitedBy,
      joinedAt: projectCollaborator.createdAt,
      name: user.name,
      title: member.title,
      userId: user.id,
    })
    .from(projectCollaborator)
    .innerJoin(user, eq(user.id, projectCollaborator.userId))
    .leftJoin(member, eq(member.userId, user.id))
    .where(eq(projectCollaborator.projectId, projectId))
    .orderBy(asc(projectCollaborator.createdAt));

  return rows.map((row) => ({
    image: projectUserAvatar(row.image, row.userId),
    joinedAt: row.joinedAt,
    name: row.name,
    role: "collaborator" as const,
    title: row.title,
    userId: row.userId,
  }));
}

/** 对话全部参与者（所有者在首位）。已移除/退出的账号（用户行删除级联）自然消失。 */
export async function listProjectParticipants(
  projectId: string
): Promise<ProjectParticipant[]> {
  const [owner] = await db
    .select({
      createdAt: project.createdAt,
      image: user.image,
      name: user.name,
      title: member.title,
      userId: user.id,
    })
    .from(project)
    .innerJoin(user, eq(user.id, project.userId))
    .leftJoin(member, eq(member.userId, user.id))
    .where(eq(project.id, projectId))
    .limit(1);

  if (!owner) {
    return [];
  }

  const collaborators = await listProjectCollaborators(projectId);

  return [
    {
      image: projectUserAvatar(owner.image, owner.userId),
      joinedAt: owner.createdAt,
      name: owner.name,
      role: "owner" as const,
      title: owner.title,
      userId: owner.userId,
    },
    ...collaborators,
  ];
}

/**
 * 添加协作成员（幂等）。memberIds 必须先经 `filterExistingMemberIds` 或等价
 * 校验确认为启用成员，这里只按 (projectId, userId) 去重插入。
 */
export async function addProjectCollaborators(
  projectId: string,
  invitedBy: string,
  userIds: string[]
): Promise<number> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) {
    return 0;
  }

  const inserted = await db
    .insert(projectCollaborator)
    .values(
      unique.map((userId) => ({
        invitedBy,
        projectId,
        userId,
      }))
    )
    .onConflictDoNothing()
    .returning({ id: projectCollaborator.id });

  return inserted.length;
}

export async function removeProjectCollaborator(
  projectId: string,
  userId: string
): Promise<boolean> {
  const removed = await db
    .delete(projectCollaborator)
    .where(
      and(
        eq(projectCollaborator.projectId, projectId),
        eq(projectCollaborator.userId, userId)
      )
    )
    .returning({ id: projectCollaborator.id });
  return removed.length > 0;
}

export async function getActiveShareInvite(
  projectId: string
): Promise<ShareInviteSummary | null> {
  const invite = await findActiveShareInvite(projectId);
  if (!invite) {
    return null;
  }
  return { createdAt: invite.createdAt, expiresAt: invite.expiresAt };
}
async function findActiveShareInvite(
  projectId: string
): Promise<ProjectShareInviteRecord | null> {
  const [invite] = await db
    .select()
    .from(projectShareInvite)
    .where(
      and(
        eq(projectShareInvite.projectId, projectId),
        isNull(projectShareInvite.revokedAt),
        gt(projectShareInvite.expiresAt, new Date())
      )
    )
    .orderBy(desc(projectShareInvite.createdAt))
    .limit(1);
  return invite ?? null;
}

/**
 * 生成新链接。`replaceActive`（重新生成）先撤销旧链接，使旧链接立即失效；
 * 无活跃链接时直接创建。返回中的 token 明文只在本次响应出现。
 */
export function createShareInvite(
  projectId: string,
  createdBy: string,
  { replaceActive = false }: { replaceActive?: boolean } = {}
): Promise<CreateShareInviteResult> {
  return db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: project.id })
      .from(project)
      .where(and(eq(project.id, projectId), eq(project.userId, createdBy)))
      .for("update");
    if (!owned) {
      throw new Error("project-share:not-owner");
    }
    const active = await tx
      .select()
      .from(projectShareInvite)
      .where(
        and(
          eq(projectShareInvite.projectId, projectId),
          isNull(projectShareInvite.revokedAt),
          gt(projectShareInvite.expiresAt, new Date())
        )
      );
    if (active.length && !replaceActive) {
      throw new Error("share-invite:active-exists");
    }
    await tx
      .update(projectShareInvite)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(projectShareInvite.projectId, projectId),
          isNull(projectShareInvite.revokedAt)
        )
      );
    const token = generateShareToken();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + SHARE_INVITE_TTL_DAYS * 86_400_000
    );
    await tx.insert(projectShareInvite).values({
      createdAt: now,
      createdBy,
      expiresAt,
      projectId,
      tokenHash: hashShareToken(token),
    });
    return { createdAt: now, expiresAt, token };
  });
}

/** 撤销对话的全部活跃链接（幂等）。 */
export async function revokeShareInvite(projectId: string): Promise<number> {
  const revoked = await db
    .update(projectShareInvite)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(projectShareInvite.projectId, projectId),
        isNull(projectShareInvite.revokedAt)
      )
    )
    .returning({ id: projectShareInvite.id });
  return revoked.length;
}

export async function checkShareInvite(
  projectId: string,
  token: string
): Promise<ShareInviteCheck | null> {
  if (!token || token.length > 128) {
    return null;
  }

  const [invite] = await db
    .select()
    .from(projectShareInvite)
    .where(
      and(
        eq(projectShareInvite.projectId, projectId),
        eq(projectShareInvite.tokenHash, hashShareToken(token))
      )
    )
    .limit(1);

  if (
    !invite ||
    !sameShareTokenHash(invite.tokenHash, hashShareToken(token)) ||
    invite.revokedAt ||
    invite.expiresAt <= new Date()
  ) {
    return null;
  }

  return { invite, projectId: invite.projectId };
}

/** 加入与链接撤销在邀请行锁上串行；不通过 GET 页面变更成员。 */
export function joinProjectShare(
  projectId: string,
  userId: string,
  token: string
) {
  if (!token || token.length > 128) {
    return false;
  }
  return db.transaction(async (tx) => {
    const [enabled] = await tx
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.userId, userId), eq(member.status, "enabled")))
      .for("share");
    if (!enabled) {
      return false;
    }
    const [invite] = await tx
      .select()
      .from(projectShareInvite)
      .where(
        and(
          eq(projectShareInvite.projectId, projectId),
          eq(projectShareInvite.tokenHash, hashShareToken(token))
        )
      )
      .for("update");
    if (
      !invite ||
      invite.revokedAt ||
      invite.expiresAt <= new Date() ||
      !sameShareTokenHash(invite.tokenHash, hashShareToken(token))
    ) {
      return false;
    }
    const [record] = await tx
      .select()
      .from(project)
      .where(eq(project.id, projectId));
    if (!record) {
      return false;
    }
    if (record.userId !== userId) {
      await tx
        .insert(projectCollaborator)
        .values({ invitedBy: userId, projectId, userId })
        .onConflictDoNothing();
    }
    return true;
  });
}
