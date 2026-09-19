"use client";

import { motion } from "framer-motion";
import { ChevronRightIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import useSWRInfinite from "swr/infinite";
import { usePreferences } from "@/components/preferences-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { guestRegex } from "@/lib/constants";
import type { Chat } from "@/lib/db/schema";
import { fetcher } from "@/lib/utils";
import { LoaderIcon } from "./icons";
import { ChatItem } from "./sidebar-history-item";

export type ChatHistory = {
  chats: Chat[];
  hasMore: boolean;
};

const PAGE_SIZE = 20;

const previewItems = [
  "华东区销售分析报告",
  "Q3 市场调研总结",
  "供应商合同风险审查",
  "产品方案撰写",
  "会议纪要整理",
];

function RecentLabel() {
  const { translate } = usePreferences();

  return (
    <SidebarGroupLabel className="mb-0.5 flex h-6 items-center justify-between px-3 text-[13px] font-normal text-[var(--muted-ink-soft)]">
      <span>{translate("最近", "Recent")}</span>
      <ChevronRightIcon className="size-4" />
    </SidebarGroupLabel>
  );
}

export function getChatHistoryPaginationKey(
  pageIndex: number,
  previousPageData: ChatHistory
) {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  if (pageIndex === 0) {
    return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history?limit=${PAGE_SIZE}`;
  }

  const firstChatFromPage = previousPageData.chats.at(-1);

  if (!firstChatFromPage) {
    return null;
  }

  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history?ending_before=${firstChatFromPage.id}&limit=${PAGE_SIZE}`;
}

export function SidebarHistory({ user }: { user: User | undefined }) {
  const { translate } = usePreferences();
  const { setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const id = pathname?.startsWith("/chat/") ? pathname.split("/")[2] : null;

  const {
    data: paginatedChatHistories,
    setSize,
    isValidating,
    isLoading,
    mutate,
  } = useSWRInfinite<ChatHistory>(
    user ? getChatHistoryPaginationKey : () => null,
    fetcher,
    { fallbackData: [], revalidateOnFocus: false }
  );

  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const showPreviewNotice = useCallback(
    () =>
      toast.info(
        translate("登录后可查看任务记录", "Log in to view task history")
      ),
    [translate]
  );

  const hasReachedEnd = paginatedChatHistories
    ? paginatedChatHistories.some((page) => page.hasMore === false)
    : false;

  const hasEmptyChatHistory = paginatedChatHistories
    ? paginatedChatHistories.every((page) => page.chats.length === 0)
    : false;

  const handleDelete = useCallback(() => {
    const chatToDelete = deleteId;
    const isCurrentChat = pathname === `/chat/${chatToDelete}`;

    setShowDeleteDialog(false);

    if (isCurrentChat) {
      router.replace("/");
    }

    mutate((chatHistories) => {
      if (chatHistories) {
        return chatHistories.map((chatHistory) => ({
          ...chatHistory,
          chats: chatHistory.chats.filter((chat) => chat.id !== chatToDelete),
        }));
      }
    });

    fetch(
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat?id=${chatToDelete}`,
      { method: "DELETE" }
    );

    toast.success(translate("任务已删除", "Chat deleted"));
  }, [deleteId, mutate, pathname, router, translate]);

  const handleShowDeleteDialog = useCallback((chatId: string) => {
    setDeleteId(chatId);
    setShowDeleteDialog(true);
  }, []);

  const handleViewportEnter = useCallback(() => {
    if (!isValidating && !hasReachedEnd) {
      setSize((size) => size + 1);
    }
  }, [hasReachedEnd, isValidating, setSize]);

  if (!user || guestRegex.test(user.email ?? "")) {
    return (
      <SidebarGroup className="mt-4 px-0 group-data-[collapsible=icon]:hidden">
        <RecentLabel />
        <SidebarGroupContent>
          <SidebarMenu className="gap-0.5">
            {previewItems.map((title) => (
              <SidebarMenuItem key={title}>
                <SidebarMenuButton
                  className="h-9 rounded-lg px-3 text-[14px] font-normal leading-5 text-sidebar-accent-foreground hover:bg-sidebar-accent"
                  onClick={showPreviewNotice}
                >
                  <span>{title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (isLoading) {
    return (
      <SidebarGroup className="mt-4 px-0 group-data-[collapsible=icon]:hidden">
        <RecentLabel />
        <SidebarGroupContent>
          <div className="flex flex-col gap-0.5 px-1">
            {[44, 32, 28, 64, 52].map((item) => (
              <div
                className="flex h-8 items-center gap-2 rounded-md px-2"
                key={item}
              >
                <div
                  className="h-3 max-w-(--skeleton-width) flex-1 animate-pulse rounded-md bg-sidebar-foreground/[0.06]"
                  style={
                    {
                      "--skeleton-width": `${item}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (hasEmptyChatHistory) {
    return (
      <SidebarGroup className="mt-4 px-0 group-data-[collapsible=icon]:hidden">
        <RecentLabel />
        <SidebarGroupContent>
          <div className="px-3 py-2 text-sm text-sidebar-foreground/50">
            {translate(
              "开始新任务后，记录会显示在这里",
              "Your task history will appear here"
            )}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <>
      <SidebarGroup className="mt-4 px-0 group-data-[collapsible=icon]:hidden">
        <RecentLabel />
        <SidebarGroupContent>
          <SidebarMenu>
            {paginatedChatHistories
              ? (() => {
                  const chatsFromHistory = paginatedChatHistories.flatMap(
                    (paginatedChatHistory) => paginatedChatHistory.chats
                  );

                  return (
                    <div className="flex flex-col gap-0.5">
                      {chatsFromHistory.map((chat) => (
                        <ChatItem
                          chat={chat}
                          isActive={chat.id === id}
                          key={chat.id}
                          onDelete={handleShowDeleteDialog}
                          setOpenMobile={setOpenMobile}
                        />
                      ))}
                    </div>
                  );
                })()
              : null}
          </SidebarMenu>

          <motion.div onViewportEnter={handleViewportEnter} />

          {hasReachedEnd ? null : (
            <div className="mt-1 flex flex-row items-center gap-2 px-4 py-2 text-sidebar-foreground/50">
              <div className="animate-spin">
                <LoaderIcon />
              </div>
              <div className="text-[11px]">
                {translate("加载中...", "Loading...")}
              </div>
            </div>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {translate("确认删除此任务？", "Delete this task?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {translate(
                "删除后无法恢复，该任务及其对话记录将被永久移除。",
                "This task and its conversation history will be permanently removed."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{translate("取消", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {translate("删除", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
