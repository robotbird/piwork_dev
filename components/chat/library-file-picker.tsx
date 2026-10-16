"use client";

import { CheckIcon, FileTextIcon, SearchIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useState,
} from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  isVisionAttachment,
  MAX_CHAT_ATTACHMENT_COUNT,
} from "@/lib/ai/attachment-types";
import {
  libraryAttachmentType,
  searchLibraryFiles,
} from "@/lib/documents/chat-attachments";
import { formatFileSize, type LibraryItem } from "@/lib/documents/types";
import type { Attachment } from "@/lib/types";
import { fetcher } from "@/lib/utils";

// 受控文档库选择弹窗：由调用方的「+」下拉菜单打开（聊天输入器与项目首页同款交互），
// 组件本身不渲染触发按钮。
export function LibraryFilePicker({
  attachments,
  disabled,
  onSelect,
  onBusyChange,
  dialogOpen,
  onDialogOpenChange,
}: {
  attachments: Attachment[];
  disabled: boolean;
  onSelect: (attachment: Attachment) => void | Promise<void>;
  onBusyChange: (busy: boolean) => void;
  dialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("chat");
  const commonT = useTranslations("common");
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const { data, error, isLoading, mutate } = useSWR<LibraryItem[]>(
    dialogOpen ? `${basePath}/api/library` : null,
    fetcher
  );
  const files = searchLibraryFiles(data ?? [], query);
  const activeUrls = new Set(attachments.map((attachment) => attachment.url));

  const pick = useCallback(
    async (item: LibraryItem) => {
      if (
        pending ||
        disabled ||
        attachments.some((attachment) => attachment.url === selected[item.id])
      ) {
        return;
      }
      if (attachments.length >= MAX_CHAT_ATTACHMENT_COUNT) {
        toast.error(
          commonT("attachmentLimit", { count: MAX_CHAT_ATTACHMENT_COUNT })
        );
        return;
      }
      setPending(item.id);
      onBusyChange(true);
      try {
        const response = await fetch(
          `${basePath}/api/library/${item.id}/attachment`,
          { method: "POST" }
        );
        if (!response.ok) {
          throw new Error(t("librarySelectFailed"));
        }
        const attachment = (await response.json()) as Attachment;
        await onSelect(attachment);
        setSelected((current) => ({ ...current, [item.id]: attachment.url }));
      } catch {
        toast.error(t("librarySelectFailed"));
      } finally {
        setPending(null);
        onBusyChange(false);
      }
    },
    [
      pending,
      disabled,
      selected,
      attachments,
      commonT,
      onBusyChange,
      basePath,
      t,
      onSelect,
    ]
  );

  const handleQuery = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
    []
  );
  const handleRetry = useCallback(() => {
    mutate();
  }, [mutate]);
  const handleDone = useCallback(
    () => onDialogOpenChange(false),
    [onDialogOpenChange]
  );
  const handlePick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const item = data?.find(
        (file) => file.id === event.currentTarget.dataset.fileId
      );
      if (item) {
        pick(item);
      }
    },
    [data, pick]
  );

  return (
    <Dialog onOpenChange={onDialogOpenChange} open={dialogOpen}>
      <DialogContent
        className="flex h-[70dvh] max-h-[640px] w-[calc(100vw-2rem)] max-w-none flex-col gap-3 overflow-hidden rounded-2xl p-4 sm:h-[58dvh] sm:w-[min(640px,calc(100vw-3rem))] sm:max-w-none sm:p-6 lg:w-[40vw] lg:max-w-[800px]"
        data-testid="library-file-browser"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("chooseLibraryFiles")}</DialogTitle>
        </DialogHeader>
        <div className="relative m-2 shrink-0">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
          />
          <Input
            aria-label={t("searchLibraryFiles")}
            className="h-10 pl-9"
            onChange={handleQuery}
            placeholder={t("searchLibraryFiles")}
            value={query}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {error ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <p>{t("libraryLoadFailed")}</p>
              <Button
                className="mt-2"
                onClick={handleRetry}
                type="button"
                variant="outline"
              >
                {t("libraryRetry")}
              </Button>
            </div>
          ) : isLoading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("libraryLoading")}
            </p>
          ) : files.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("libraryEmpty")}
            </p>
          ) : (
            files.map((item) => {
              const supported = libraryAttachmentType(item);
              const isSelected = activeUrls.has(selected[item.id]);
              return (
                <button
                  aria-pressed={isSelected}
                  className="flex min-h-14 w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted disabled:opacity-50"
                  data-file-id={item.id}
                  disabled={!supported || pending !== null || disabled}
                  key={item.id}
                  onClick={handlePick}
                  title={supported ? item.name : t("libraryUnsupported")}
                  type="button"
                >
                  {isVisionAttachment(item.contentType ?? "") ? (
                    <Image
                      alt=""
                      className="size-10 shrink-0 rounded-md border border-border object-cover"
                      height={40}
                      src={`${basePath}/api/library/${item.id}?preview=1`}
                      unoptimized
                      width={40}
                    />
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                      <FileTextIcon
                        aria-hidden="true"
                        className="size-5 text-muted-foreground"
                      />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{item.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {supported
                        ? formatFileSize(item.size)
                        : t("libraryUnsupported")}
                    </span>
                  </span>
                  {isSelected ? (
                    <CheckIcon aria-hidden="true" className="size-4 shrink-0" />
                  ) : pending === item.id ? (
                    <span className="text-xs">…</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
        <div className="flex shrink-0 justify-end border-t border-border pt-3">
          <Button onClick={handleDone} type="button">
            {t("libraryDone")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
