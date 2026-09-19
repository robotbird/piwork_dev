"use client";

import {
  FolderIcon,
  MoreHorizontalIcon,
  PanelLeftIcon,
  Share2Icon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { memo } from "react";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
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
  const { translate } = usePreferences();

  return (
    <header className="relative flex h-14 shrink-0 items-center bg-background px-4 md:px-6">
      {isMobile ? (
        <Button
          aria-label={translate("打开侧边栏", "Open sidebar")}
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
              · {translate("工作", "Work")}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1 text-muted-foreground">
            <Button
              aria-label={translate("分享对话", "Share conversation")}
              className="hidden gap-2 px-2.5 sm:inline-flex"
              size="sm"
              variant="ghost"
            >
              <Share2Icon className="size-[17px]" />
              <span>{translate("分享", "Share")}</span>
            </Button>
            <Button
              aria-label={translate("更多操作", "More actions")}
              size="icon-sm"
              variant="ghost"
            >
              <MoreHorizontalIcon className="size-[18px]" />
            </Button>
            <Button
              aria-label={translate("对话设置", "Conversation settings")}
              size="icon-sm"
              variant="ghost"
            >
              <SlidersHorizontalIcon className="size-[18px]" />
            </Button>
          </div>
        </>
      ) : null}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader);
