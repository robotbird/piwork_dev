"use client";

import { BellIcon, PanelLeftIcon, PanelTopIcon } from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import type { VisibilityType } from "./visibility-selector";

function PureChatHeader({
  chatId: _chatId,
  selectedVisibilityType: _selectedVisibilityType,
  isReadonly: _isReadonly,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { toggleSidebar, isMobile } = useSidebar();

  return (
    <header className="flex h-[60px] shrink-0 items-center border-b border-border/70 bg-background/90 px-4 backdrop-blur-md md:px-7">
      {isMobile ? (
        <Button
          aria-label="打开侧边栏"
          className="text-foreground/70"
          onClick={toggleSidebar}
          size="icon-sm"
          variant="ghost"
        >
          <PanelLeftIcon className="size-[18px]" />
        </Button>
      ) : null}

      <div className="ml-auto flex items-center gap-3 text-[#1f2a3d] dark:text-foreground/80">
        <Button aria-label="通知" size="icon-sm" variant="ghost">
          <BellIcon className="size-[18px]" strokeWidth={1.7} />
        </Button>
        <span className="h-4 w-px bg-border/80" />
        <Button aria-label="工作面板" size="icon-sm" variant="ghost">
          <PanelTopIcon className="size-[18px]" strokeWidth={1.7} />
        </Button>
      </div>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader);
