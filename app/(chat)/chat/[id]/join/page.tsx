import { Link2OffIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/app/(auth)/auth";
import { JoinActions, OpenChatButton } from "@/components/chat/join-actions";
import { UserAvatar } from "@/components/chat/user-avatar";
import {
  checkShareInvite,
  getChatAccess,
  getChatShareSummary,
} from "@/lib/db/chat-share-queries";
import { getMemberByUserId } from "@/lib/db/organization-queries";

/**
 * 分享链接落地页（/chat/:chatId/join?t=token）：
 * - 链接无效/过期/对话不存在 → 失效卡片，不泄露对话内容；
 * - 已是对话成员 → 直接进入；
 * - 其他登录启用成员 → 对话概要 + 「参与协作」/「Fork 新对话」二选一。
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
    <main className="flex min-h-[calc(100dvh-theme(spacing.14))] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
          <Link2OffIcon className="size-5 text-muted-foreground" />
        </div>
        <h1 className="mb-1.5 text-[18px] font-semibold text-foreground">
          {t("join.linkInvalidTitle")}
        </h1>
        <p className="text-[13px] leading-5 text-muted-foreground">
          {t("join.linkInvalidDescription")}
        </p>
      </div>
    </main>
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
    <main className="flex min-h-[calc(100dvh-theme(spacing.14))] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8">
        <p className="mb-4 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
          {t("join.eyebrow")}
        </p>

        <h1 className="mb-5 text-[20px] leading-7 font-semibold text-foreground">
          {summary.title}
        </h1>

        <div className="mb-6 flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-subtle px-4 py-3">
          <UserAvatar
            image={summary.ownerImage}
            name={summary.ownerName}
            size={36}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-foreground">
              {summary.ownerName ?? t("join.unknownOwner")}
            </p>
            <p className="text-[12px] text-muted-foreground">
              {t("join.ownerLabel")}
            </p>
          </div>
          <div className="text-right text-[12px] leading-4 text-muted-foreground">
            <p>{t("join.messageCount", { count: summary.messageCount })}</p>
            <p>
              {t("join.participantCount", {
                count: summary.collaboratorCount + 1,
              })}
            </p>
          </div>
        </div>

        {isMember ? (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">
              {t("join.alreadyMember")}
            </p>
            <OpenChatButton chatId={id} />
          </div>
        ) : enabled ? (
          <div className="space-y-3">
            <p className="text-[13px] leading-5 text-muted-foreground">
              {t("join.chooseHint")}
            </p>
            <JoinActions chatId={id} token={token} />
            <p className="text-[12px] leading-5 text-muted-foreground">
              {t("join.forkHint")}
            </p>
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            {t("join.notEnabled")}
          </p>
        )}

        <p className="mt-6 text-center text-[12px] text-muted-foreground">
          {t("join.inviteHint")}
        </p>
      </div>
    </main>
  );
}
