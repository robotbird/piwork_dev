"use client";

import Link from "next/link";
import { memo, useCallback } from "react";
import { usePreferences } from "@/components/preferences-provider";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { SharedChatListItem } from "@/lib/db/chat-share-queries";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import {
  CheckCircleFillIcon,
  GlobeIcon,
  LockIcon,
  MoreHorizontalIcon,
  ShareIcon,
  TrashIcon,
} from "./icons";

const PureChatItem = ({
  chat,
  isActive,
  onDelete,
  setOpenMobile,
}: {
  chat: SharedChatListItem;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
}) => {
  const { t } = usePreferences();
  // 协作成员不可改可见性（服务端拒绝）；仅所有者渲染管理菜单
  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId: chat.id,
    initialVisibilityType: chat.visibility,
  });
  const closeMobile = useCallback(() => {
    setOpenMobile(false);
  }, [setOpenMobile]);

  const handleSetPrivate = useCallback(() => {
    setVisibilityType("private");
  }, [setVisibilityType]);

  const handleSetPublic = useCallback(() => {
    setVisibilityType("public");
  }, [setVisibilityType]);

  const handleDelete = useCallback(() => {
    onDelete(chat.id);
  }, [chat.id, onDelete]);

  // 协作对话：显示「共享」标记与所有者；管理菜单（可见性/删除）仅所有者可见
  const isShared = (chat as SharedChatListItem).sharedWithMe === true;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className="h-9 rounded-lg px-3 text-[14px] leading-5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent"
        isActive={isActive}
      >
        <Link href={`/chat/${chat.id}`} onClick={closeMobile}>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate">{chat.title}</span>
            {isShared ? (
              <span
                className="shrink-0 rounded border border-border-subtle bg-surface-subtle px-1 py-px text-[10px] leading-3.5 text-muted-foreground"
                title={(chat as SharedChatListItem).ownerName ?? undefined}
              >
                {t("chat.sharedBadge")}
              </span>
            ) : null}
          </span>
        </Link>
      </SidebarMenuButton>

      {isShared ? null : (
        <DropdownMenu modal={true}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              className="mr-0.5 rounded-md text-sidebar-foreground/50 ring-0 transition-colors duration-150 focus-visible:ring-0 hover:text-sidebar-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              showOnHover={!isActive}
            >
              <MoreHorizontalIcon />
              <span className="sr-only">{t("chat.more")}</span>
            </SidebarMenuAction>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" side="bottom">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <ShareIcon />
                <span>{t("chat.share")}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    className="cursor-pointer flex-row justify-between"
                    onClick={handleSetPrivate}
                  >
                    <div className="flex flex-row items-center gap-2">
                      <LockIcon size={12} />
                      <span>{t("chat.private")}</span>
                    </div>
                    {visibilityType === "private" ? (
                      <CheckCircleFillIcon />
                    ) : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer flex-row justify-between"
                    onClick={handleSetPublic}
                  >
                    <div className="flex flex-row items-center gap-2">
                      <GlobeIcon />
                      <span>{t("chat.public")}</span>
                    </div>
                    {visibilityType === "public" ? (
                      <CheckCircleFillIcon />
                    ) : null}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuItem onSelect={handleDelete} variant="destructive">
              <TrashIcon />
              <span>{t("common.delete")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </SidebarMenuItem>
  );
};

export const ChatItem = memo(PureChatItem, (prevProps, nextProps) => {
  if (prevProps.isActive !== nextProps.isActive) {
    return false;
  }
  return true;
});
