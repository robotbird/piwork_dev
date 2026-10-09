"use client";

import {
  FolderIcon,
  MoreHorizontalIcon,
  PanelLeftIcon,
  Share2Icon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { memo, useCallback, useState } from "react";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { useActiveChat } from "@/hooks/use-active-chat";
import { ParticipantAvatars } from "./participant-avatars";
import { ShareDialog } from "./share-dialog";
import type { VisibilityType } from "./visibility-selector";

function PureChatHeader({
  hasMessages,
  title,
  chatId: _chatId,
  selectedVisibilityType: _selectedVisibilityType,
  isReadonly: _isReadonly,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  hasMessages: boolean;
  title: string;
}) {
  const { toggleSidebar, isMobile } = useSidebar();
  const { t } = usePreferences();
  const { chatId, myRole, onlineUserIds, participants, typingUserIds } =
    useActiveChat();
  const [shareOpen, setShareOpen] = useState(false);

  const handleShareOpen = useCallback(() => setShareOpen(true), []);

  const handleShareClose = useCallback(() => setShareOpen(false), []);

  // 分享是所有者操作：协作成员/只读视图不展示入口
  const canShare = myRole === "owner";
  const showCollaboration = participants.length > 1;

  return (
    <header className="relative flex h-14 shrink-0 items-center bg-background px-4 md:px-6">
      {isMobile ? (
        <Button
          aria-label={t("chat.openSidebar")}
          className="text-foreground/70"
          onClick={toggleSidebar}
          size="icon-sm"
          variant="ghost"
        >
          <PanelLeftIcon className="size-[18px]" />
        </Button>
      ) : null}

      {hasMessages ? (
        <>
          <div className="flex min-w-0 items-center gap-2.5 text-[15px]">
            <FolderIcon className="size-[18px] shrink-0 text-muted-foreground" />
            <span className="hidden font-medium text-foreground sm:inline">
              PiWork
            </span>
            <span className="hidden text-muted-foreground sm:inline">/</span>
            <span className="max-w-[min(42vw,460px)] truncate text-muted-foreground">
              {title}
            </span>
            <span className="hidden text-muted-foreground/70 sm:inline">
              · {t("chat.work")}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1 text-muted-foreground">
            {showCollaboration ? (
              <ParticipantAvatars
                onlineUserIds={onlineUserIds}
                participants={participants}
                typingUserIds={typingUserIds}
              />
            ) : null}
            {typingUserIds.length > 0 ? (
              <span className="hidden max-w-[180px] truncate text-[12px] text-muted-foreground sm:inline">
                {typingUserIds.length === 1
                  ? t("chat.collab.typing", {
                      name:
                        participants.find((p) => p.userId === typingUserIds[0])
                          ?.name ?? "",
                    })
                  : t("chat.collab.typingMultiple", {
                      count: typingUserIds.length,
                    })}
              </span>
            ) : null}
            {canShare ? (
              <Button
                aria-label={t("chat.shareConversation")}
                className="hidden gap-2 px-2.5 sm:inline-flex"
                onClick={handleShareOpen}
                size="sm"
                variant="ghost"
              >
                <Share2Icon className="size-[17px]" />
                <span>{t("chat.share")}</span>
              </Button>
            ) : null}
            <Button
              aria-label={t("common.moreActions")}
              size="icon-sm"
              variant="ghost"
            >
              <MoreHorizontalIcon className="size-[18px]" />
            </Button>
            <Button
              aria-label={t("chat.conversationSettings")}
              size="icon-sm"
              variant="ghost"
            >
              <SlidersHorizontalIcon className="size-[18px]" />
            </Button>
          </div>
        </>
      ) : null}

      {canShare ? (
        <ShareDialog
          chatId={chatId}
          onClose={handleShareClose}
          open={shareOpen && hasMessages}
        />
      ) : null}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader);
