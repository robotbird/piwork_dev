"use client";

import {
  CheckIcon,
  FileTextIcon,
  LibraryBigIcon,
  SearchIcon,
} from "lucide-react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

export function LibraryFilePicker({
  attachments,
  disabled,
  onSelect,
  onBusyChange,
}: {
  attachments: Attachment[];
  disabled: boolean;
  onSelect: (attachment: Attachment) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const t = useTranslations("chat");
  const commonT = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [browseAll, setBrowseAll] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const { data, error, isLoading, mutate } = useSWR<LibraryItem[]>(
    open || browseAll ? `${basePath}/api/library` : null,
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
        setSelected((current) => ({ ...current, [item.id]: attachment.url }));
        onSelect(attachment);
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
  const handleBrowseAll = useCallback(() => {
    setOpen(false);
    setBrowseAll(true);
  }, []);
  const handleDone = useCallback(() => setBrowseAll(false), []);
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

  function renderFiles(all: boolean) {
    return (
      <>
        <div className="relative m-2">
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
        <div
          className={
            all
              ? "max-h-[60dvh] overflow-y-auto p-2"
              : "max-h-[min(360px,45dvh)] overflow-y-auto p-2"
          }
        >
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
            files.slice(0, all ? undefined : 7).map((item) => {
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
                    {all || !supported ? (
                      <span className="block text-xs text-muted-foreground">
                        {supported
                          ? formatFileSize(item.size)
                          : t("libraryUnsupported")}
                      </span>
                    ) : null}
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
      </>
    );
  }

  return (
    <>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <button
            aria-label={t("chooseLibraryFiles")}
            className="flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            disabled={disabled}
            type="button"
          >
            <LibraryBigIcon className="size-4 shrink-0" />
            <span>{t("files")}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(360px,calc(100vw-32px))] p-0"
          data-testid="library-file-picker"
          side="top"
          sideOffset={8}
        >
          {renderFiles(false)}
          <div className="border-t border-border p-2">
            <button
              className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm hover:bg-muted"
              onClick={handleBrowseAll}
              type="button"
            >
              <LibraryBigIcon className="size-5" />
              {t("browseAllLibraryFiles")}
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <Dialog onOpenChange={setBrowseAll} open={browseAll}>
        <DialogContent
          className="max-w-2xl p-4"
          data-testid="library-file-browser"
        >
          <DialogHeader>
            <DialogTitle>{t("chooseLibraryFiles")}</DialogTitle>
          </DialogHeader>
          {renderFiles(true)}
          <div className="flex justify-end border-t border-border pt-3">
            <Button onClick={handleDone} type="button">
              {t("libraryDone")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
