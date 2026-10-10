import { getTranslations } from "next-intl/server";
import { auth } from "@/app/(auth)/auth";
import { JoinActions } from "@/components/chat/join-actions";
import { JoinDialog } from "@/components/chat/join-dialog";
import { UserAvatar } from "@/components/chat/user-avatar";
import {
  checkShareInvite,
  getChatAccess,
  getChatShareSummary,
} from "@/lib/db/chat-share-queries";
import { getMemberByUserId } from "@/lib/db/organization-queries";

/**
 * 分享链接落地页（/chat/:chatId/join?t=token）：
 * - 链接无效/过期/对话不存在 → 失效弹框，不泄露对话内容；
 * - 正式启用成员始终可选协作或 Fork；已是对话成员则直接进入协作。
 */
export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const [{ id }, { t: token }, session, t] = await Promise.all([
    params,
    searchParams,
    auth(),
    getTranslations("chat"),
  ]);

  const invalidCard = (
    <JoinDialog
      description={t("join.linkInvalidDescription")}
      title={t("join.linkInvalidTitle")}
    />
  );

  if (!session?.user || !token) {
    return invalidCard;
  }

  const invite = await checkShareInvite(id, token);
  if (!invite) {
    return invalidCard;
  }

  const [summary, access, member] = await Promise.all([
    getChatShareSummary(id),
    getChatAccess(id, session.user.id),
    getMemberByUserId(session.user.id),
  ]);

  if (!summary) {
    return invalidCard;
  }

  const isMember = Boolean(access?.isOwner || access?.isCollaborator);
  const enabled = member?.status === "enabled";

  return (
    <JoinDialog
      description={t("join.eyebrow")}
      footer={t("join.inviteHint")}
      title={summary.title}
    >
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
        <UserAvatar
          image={summary.ownerImage}
          name={summary.ownerName}
          size={36}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {summary.ownerName ?? t("join.unknownOwner")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("join.ownerLabel")}
          </p>
        </div>
        <div className="shrink-0 text-right text-xs leading-5 tabular-nums text-muted-foreground">
          <p>{t("join.messageCount", { count: summary.messageCount })}</p>
          <p>
            {t("join.participantCount", {
              count: summary.collaboratorCount + 1,
            })}
          </p>
        </div>
      </div>

      {enabled ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-5 text-muted-foreground">
            {t(isMember ? "join.alreadyMember" : "join.chooseHint")}
          </p>
          <JoinActions chatId={id} isMember={isMember} token={token} />
          <p className="text-xs leading-5 text-muted-foreground">
            {t("join.forkHint")}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("join.notEnabled")}</p>
      )}
    </JoinDialog>
  );
}
