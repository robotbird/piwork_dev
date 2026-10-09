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
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
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
import type { ChatParticipantInfo } from "@/lib/types";
import { cn, fetcher } from "@/lib/utils";
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

function formatExpiry(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

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
  const locale = useLocale();
  const { data, mutate } = useSWR<ShareData>(
    open
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat/share?chatId=${chatId}`
      : null,
    fetcher
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [keyword, setKeyword] = useState("");
  const [adding, setAdding] = useState(false);
  // 仅在生成响应返回 token 的一次性展示；关闭后不可再取回
  const [freshLink, setFreshLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const isOwner = data?.isOwner ?? false;

  const filteredMembers = useMemo(() => {
    const list = data?.members ?? [];
    const kw = keyword.trim().toLowerCase();
    if (!kw) {
      return list;
    }
    return list.filter(
      (member) =>
        (member.name ?? "").toLowerCase().includes(kw) ||
        (member.title ?? "").toLowerCase().includes(kw)
    );
  }, [data?.members, keyword]);

  const toggleMember = useCallback((userId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  const handleAddMembers = useCallback(async () => {
    if (selected.size === 0) {
      return;
    }
    setAdding(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat/share`,
        {
          body: JSON.stringify({
            chatId,
            memberIds: [...selected],
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setSelected(new Set());
      setKeyword("");
      await mutate();
      toast.success(t("membersAdded"));
    } catch {
      toast.error(t("actionFailed"));
    } finally {
      setAdding(false);
    }
  }, [chatId, mutate, selected, t]);

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
          setFreshLink(
            `${origin}/chat/${chatId}/join?t=${encodeURIComponent(created.token)}`
          );
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
      setFreshLink(null);
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
    try {
      await navigator.clipboard.writeText(freshLink);
      setCopied(true);
      toast.success(t("linkCopied"));
    } catch {
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
      toggleMember(event.target.value);
    },
    [toggleMember]
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

  const handleGenerateClick = useCallback(() => {
    handleGenerate(Boolean(data?.invite) || Boolean(freshLink));
  }, [data?.invite, freshLink, handleGenerate]);

  return (
    <Dialog onOpenChange={handleDialogOpenChange} open={open}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b px-5 pb-4 pt-5">
          <DialogTitle className="text-[16px] font-semibold">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {isOwner ? (
            <section aria-label={t("pickMembers")}>
              <p className="mb-2 text-[13px] font-medium text-foreground">
                {t("pickMembers")}
              </p>
              <div className="relative mb-2">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 bg-surface-subtle pl-8 text-[13px]"
                  onChange={handleKeywordChange}
                  placeholder={t("searchMembers")}
                  value={keyword}
                />
              </div>
              <div className="max-h-44 overflow-y-auto rounded-lg border border-border-subtle">
                {filteredMembers.length === 0 ? (
                  <p className="px-3 py-4 text-[13px] text-muted-foreground">
                    {t("noMembers")}
                  </p>
                ) : (
                  filteredMembers.map((member) => {
                    const checked = selected.has(member.userId);
                    return (
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 border-b border-border-subtle px-3 py-2 text-[13px] transition-colors last:border-b-0 hover:bg-surface-subtle",
                          checked && "bg-accent-soft/60"
                        )}
                        key={member.userId}
                      >
                        <input
                          checked={checked}
                          className="size-4 accent-[var(--primary)]"
                          onChange={handleToggleChange}
                          type="checkbox"
                          value={member.userId}
                        />
                        <UserAvatar
                          image={member.image}
                          name={member.name}
                          size={24}
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
              <Button
                className="mt-2 h-8 w-full rounded-lg text-[13px]"
                disabled={selected.size === 0 || adding}
                onClick={handleAddMembers}
                size="sm"
              >
                {adding
                  ? t("adding")
                  : t("addSelected", { count: selected.size })}
              </Button>
            </section>
          ) : null}

          <section aria-label={t("currentCollaborators")}>
            <p className="mb-2 text-[13px] font-medium text-foreground">
              {t("currentCollaborators")}
              {collaborators.length > 0 ? (
                <span className="ml-1.5 text-muted-foreground">
                  {collaborators.length}
                </span>
              ) : null}
            </p>
            {collaborators.length === 0 ? (
              <p className="rounded-lg border border-border-subtle px-3 py-3 text-[13px] text-muted-foreground">
                {t("noCollaborators")}
              </p>
            ) : (
              <ul className="overflow-hidden rounded-lg border border-border-subtle">
                {collaborators.map((collaborator) => (
                  <li
                    className="flex items-center gap-2.5 border-b border-border-subtle px-3 py-2 text-[13px] last:border-b-0"
                    key={collaborator.userId}
                  >
                    <UserAvatar
                      image={collaborator.image}
                      name={collaborator.name}
                      size={24}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {collaborator.name ?? collaborator.userId}
                    </span>
                    {isOwner ? (
                      <button
                        aria-label={t("remove")}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-danger-soft hover:text-destructive"
                        data-user-id={collaborator.userId}
                        onClick={handleRemoveClick}
                        type="button"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {isOwner ? (
            <section aria-label={t("linkSection")}>
              <p className="mb-2 text-[13px] font-medium text-foreground">
                {t("linkSection")}
              </p>
              {freshLink ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2">
                    <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <code className="min-w-0 flex-1 truncate font-mono text-[12px]">
                      {freshLink}
                    </code>
                    <Button
                      aria-label={t("copyLink")}
                      className="size-7 shrink-0"
                      onClick={handleCopy}
                      size="icon-sm"
                      variant="ghost"
                    >
                      {copied ? (
                        <CheckIcon className="size-3.5 text-success" />
                      ) : (
                        <CopyIcon className="size-3.5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-[12px] leading-5 text-muted-foreground">
                    {t("linkOnceNote")}
                  </p>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="h-8 rounded-lg gap-1.5 text-[13px]"
                  disabled={busyAction}
                  onClick={handleGenerateClick}
                  size="sm"
                  variant={data?.invite || freshLink ? "outline" : "default"}
                >
                  <RefreshCwIcon className="size-3.5" />
                  {data?.invite || freshLink
                    ? t("regenerateLink")
                    : t("generateLink")}
                </Button>
                {data?.invite && !freshLink ? (
                  <Button
                    className="h-8 rounded-lg gap-1.5 text-[13px] text-destructive hover:bg-danger-soft hover:text-destructive"
                    disabled={busyAction}
                    onClick={handleRevoke}
                    size="sm"
                    variant="ghost"
                  >
                    <TrashIcon className="size-3.5" />
                    {t("revokeLink")}
                  </Button>
                ) : null}
              </div>
              <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
                {data?.invite
                  ? t("activeLinkHint", {
                      expiresAt: formatExpiry(data.invite.expiresAt, locale),
                    })
                  : t("noActiveLink")}
              </p>
            </section>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
