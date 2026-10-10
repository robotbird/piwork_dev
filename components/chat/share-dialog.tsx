"use client";

import {
  CheckIcon,
  CopyIcon,
  LinkIcon,
  RefreshCwIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChatParticipantInfo } from "@/lib/types";
import { cn, copyTextToClipboard, fetcher } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";

type ShareMember = {
  image: string | null;
  name: string | null;
  title: string | null;
  userId: string;
};

type ShareData = {
  chatTitle: string;
  collaborators: ChatParticipantInfo[];
  invite: { createdAt: string; expiresAt: string } | null;
  isOwner: boolean;
  members: ShareMember[];
  myRole: "owner" | "collaborator" | null;
  participants: ChatParticipantInfo[];
};

type ShareCreateResponse = {
  added: number;
  collaborators: ChatParticipantInfo[];
  inviteExpiresAt: string | null;
  token: string | null;
};

export function ShareDialog({
  chatId,
  onClose,
  open,
}: {
  chatId: string;
  onClose: () => void;
  open: boolean;
}) {
  const t = useTranslations("chat.shareDialog");
  const { data, mutate } = useSWR<ShareData>(
    open
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat/share?chatId=${chatId}`
      : null,
    fetcher
  );

  const [pendingMembers, setPendingMembers] = useState<Set<string>>(new Set());
  const pendingMembersRef = useRef(new Set<string>());
  const [keyword, setKeyword] = useState("");
  // 服务端不回显 token；仅在当前组件内暂存生成响应，重开不重复轮换。
  const [generatedLink, setGeneratedLink] = useState<{
    chatId: string;
    expiresAt: string;
    url: string;
  } | null>(null);
  const freshLink =
    generatedLink?.chatId === chatId &&
    Date.parse(generatedLink.expiresAt) > Date.now()
      ? generatedLink.url
      : null;
  const autoGenerateAttemptRef = useRef<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const isOwner = data?.isOwner ?? false;

  const filteredMembers = useMemo(() => {
    const collaboratorIds = new Set(
      data?.collaborators.map((member) => member.userId) ?? []
    );
    const list = (data?.members ?? []).filter(
      (member) => !collaboratorIds.has(member.userId)
    );
    const kw = keyword.trim().toLowerCase();
    if (!kw) {
      return list;
    }
    return list.filter(
      (member) =>
        (member.name ?? "").toLowerCase().includes(kw) ||
        (member.title ?? "").toLowerCase().includes(kw)
    );
  }, [data?.collaborators, data?.members, keyword]);

  const handleAddMember = useCallback(
    async (userId: string) => {
      const key = `${chatId}:${userId}`;
      if (pendingMembersRef.current.has(key)) {
        return;
      }
      pendingMembersRef.current.add(key);
      setPendingMembers(new Set(pendingMembersRef.current));
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat/share`,
          {
            body: JSON.stringify({
              chatId,
              memberIds: [userId],
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          }
        );
        if (!response.ok) {
          throw new Error(await response.text());
        }
        await mutate();
      } catch {
        toast.error(t("actionFailed"));
      } finally {
        pendingMembersRef.current.delete(key);
        setPendingMembers(new Set(pendingMembersRef.current));
      }
    },
    [chatId, mutate, t]
  );

  const handleGenerate = useCallback(
    async (regenerate: boolean) => {
      setBusyAction(true);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat/share`,
          {
            body: JSON.stringify({
              chatId,
              ...(regenerate ? { regenerate: true } : {}),
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          }
        );
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const created = (await response.json()) as ShareCreateResponse;
        if (created.token) {
          const url = new URL(window.location.href);
          const origin = `${url.protocol}//${url.host}${
            process.env.NEXT_PUBLIC_BASE_PATH ?? ""
          }`;
          setGeneratedLink({
            chatId,
            expiresAt: created.inviteExpiresAt ?? "",
            url: `${origin}/chat/${chatId}/join?t=${encodeURIComponent(created.token)}`,
          });
          setCopied(false);
        }
        await mutate();
      } catch {
        toast.error(t("actionFailed"));
      } finally {
        setBusyAction(false);
      }
    },
    [chatId, mutate, t]
  );

  useEffect(() => {
    if (!open) {
      autoGenerateAttemptRef.current = null;
      return;
    }
    if (freshLink) {
      // 重开复用也消耗本次自动生成机会，随后撤销不能被自动生成抵消。
      autoGenerateAttemptRef.current = chatId;
      return;
    }
    if (!isOwner || busyAction || autoGenerateAttemptRef.current === chatId) {
      return;
    }
    // 每次打开最多自动尝试一次（含 StrictMode），失败保留手动重试。
    // 原文不在内存但 DB 有活跃链接时必须轮换，不能从哈希还原 token。
    autoGenerateAttemptRef.current = chatId;
    handleGenerate(Boolean(data?.invite));
  }, [
    open,
    isOwner,
    freshLink,
    busyAction,
    chatId,
    data?.invite,
    handleGenerate,
  ]);

  const handleRevoke = useCallback(async () => {
    setBusyAction(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat/share?chatId=${chatId}&invite=1`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setGeneratedLink(null);
      await mutate();
      toast.success(t("linkRevoked"));
    } catch {
      toast.error(t("actionFailed"));
    } finally {
      setBusyAction(false);
    }
  }, [chatId, mutate, t]);

  const handleRemove = useCallback(
    async (userId: string) => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat/share?chatId=${chatId}&userId=${userId}`,
          { method: "DELETE" }
        );
        if (!response.ok) {
          throw new Error(await response.text());
        }
        await mutate();
      } catch {
        toast.error(t("actionFailed"));
      }
    },
    [chatId, mutate, t]
  );

  const handleCopy = useCallback(async () => {
    if (!freshLink) {
      return;
    }
    const succeeded = await copyTextToClipboard(freshLink);
    if (succeeded) {
      setCopied(true);
      toast.success(t("linkCopied"));
    } else {
      toast.error(t("copyFailed"));
    }
  }, [freshLink, t]);

  const collaborators = data?.collaborators ?? [];

  const handleDialogOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        onClose();
      }
    },
    [onClose]
  );

  const handleKeywordChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setKeyword(event.target.value);
    },
    []
  );

  const handleToggleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.checked) {
        handleAddMember(event.target.value);
      }
    },
    [handleAddMember]
  );

  const handleRemoveClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const { userId } = event.currentTarget.dataset;
      if (userId) {
        handleRemove(userId);
      }
    },
    [handleRemove]
  );

  const handleLinkFocus = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      event.currentTarget.select();
    },
    []
  );

  const handleGenerateClick = useCallback(() => {
    handleGenerate(Boolean(data?.invite) || Boolean(freshLink));
  }, [data?.invite, freshLink, handleGenerate]);

  return (
    <Dialog onOpenChange={handleDialogOpenChange} open={open}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-[22px] p-0 shadow-[0_18px_55px_rgb(0_0_0/0.16),0_2px_8px_rgb(0_0_0/0.08)] sm:max-w-[520px]"
        overlayClassName="bg-foreground/20"
      >
        <DialogHeader className="shrink-0 px-6 pb-5 pt-6 pr-14">
          <DialogTitle className="text-base font-semibold leading-6">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-sm leading-5">
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6">
          {isOwner ? (
            <section aria-label={t("pickMembers")}>
              <h3 className="mb-3 text-sm font-semibold">{t("pickMembers")}</h3>
              <div className="relative mb-2">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label={t("searchMembers")}
                  className="h-9 rounded-[10px] pl-8"
                  onChange={handleKeywordChange}
                  placeholder={t("searchMembers")}
                  value={keyword}
                />
              </div>
              <div className="max-h-36 overflow-y-auto overscroll-contain rounded-[14px] border">
                {filteredMembers.length === 0 ? (
                  <p className="px-3 py-4 text-[13px] text-muted-foreground">
                    {t("noMembers")}
                  </p>
                ) : (
                  filteredMembers.map((member) => {
                    const checked = pendingMembers.has(
                      `${chatId}:${member.userId}`
                    );
                    return (
                      <label
                        className={cn(
                          "flex min-h-12 cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm transition-colors last:border-b-0 hover:bg-muted/50",
                          checked && "bg-muted"
                        )}
                        key={member.userId}
                      >
                        <input
                          checked={checked}
                          className="size-4 shrink-0 accent-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          disabled={checked}
                          onChange={handleToggleChange}
                          type="checkbox"
                          value={member.userId}
                        />
                        <UserAvatar
                          image={member.image}
                          name={member.name}
                          size={28}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {member.name ?? member.userId}
                          {member.title ? (
                            <span className="ml-1.5 text-muted-foreground">
                              {member.title}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </section>
          ) : null}

          <section aria-label={t("currentCollaborators")}>
            <h3 className="mb-3 text-sm font-semibold">
              {t("currentCollaborators")}
              {collaborators.length > 0 ? (
                <span className="ml-2 text-xs font-normal tabular-nums text-muted-foreground">
                  {collaborators.length}
                </span>
              ) : null}
            </h3>
            {collaborators.length === 0 ? (
              <p className="rounded-[14px] bg-muted/50 px-3 py-4 text-sm text-muted-foreground">
                {t("noCollaborators")}
              </p>
            ) : (
              <ul className="max-h-36 overflow-y-auto overscroll-contain rounded-[14px] border">
                {collaborators.map((collaborator) => (
                  <li
                    className="flex min-h-12 items-center gap-3 border-b py-1.5 pr-2 pl-3 text-sm last:border-b-0"
                    key={collaborator.userId}
                  >
                    <UserAvatar
                      image={collaborator.image}
                      name={collaborator.name}
                      size={28}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {collaborator.name ?? collaborator.userId}
                    </span>
                    {isOwner ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            aria-label={`${t("remove")} ${collaborator.name ?? collaborator.userId}`}
                            className="rounded-[10px] max-sm:size-11"
                            data-user-id={collaborator.userId}
                            onClick={handleRemoveClick}
                            size="icon"
                            variant="ghost"
                          >
                            <XIcon />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("remove")}</TooltipContent>
                      </Tooltip>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {isOwner ? (
          <section
            aria-label={t("linkSection")}
            className="flex max-h-[60dvh] shrink-0 flex-col gap-3 overflow-y-auto border-t bg-muted/30 px-6 py-5"
          >
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <LinkIcon className="size-4 text-muted-foreground" />
              {t("linkSection")}
            </h3>
            {freshLink ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={t("linkSection")}
                    className="min-w-0 flex-1 rounded-[10px] font-mono text-xs"
                    onFocus={handleLinkFocus}
                    readOnly
                    value={freshLink}
                  />
                  <Button
                    className="rounded-[10px] max-sm:min-h-11"
                    disabled={busyAction}
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <CheckIcon data-icon="inline-start" />
                    ) : (
                      <CopyIcon data-icon="inline-start" />
                    )}
                    {t("copyLink")}
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="rounded-[10px] max-sm:min-h-11"
                disabled={busyAction}
                onClick={handleGenerateClick}
                size="sm"
                variant={data?.invite || freshLink ? "ghost" : "default"}
              >
                <RefreshCwIcon data-icon="inline-start" />
                {data?.invite || freshLink
                  ? t("regenerateLink")
                  : t("generateLink")}
              </Button>
              {data?.invite ? (
                <Button
                  className="rounded-[10px] max-sm:min-h-11"
                  disabled={busyAction}
                  onClick={handleRevoke}
                  size="sm"
                  variant="destructive"
                >
                  <TrashIcon data-icon="inline-start" />
                  {t("revokeLink")}
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
