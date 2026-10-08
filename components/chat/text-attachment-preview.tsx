"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import type { Attachment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Spinner } from "../ui/spinner";

function isTextAttachment(attachment: Attachment) {
  return (
    attachment.contentType === "text/plain" ||
    attachment.name?.toLowerCase().endsWith(".txt")
  );
}

// txt 附件的内容预览：展开后拉取文件文本，用 whitespace-pre-wrap
// 渲染，复制内容里的换行在页面上按原文显示。
export function TextAttachmentPreview({
  attachment,
  align = "left",
}: {
  attachment: Attachment;
  align?: "left" | "right";
}) {
  const t = useTranslations("chat");
  const isTxt = isTextAttachment(attachment);
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const response = await fetch(attachment.url);
      if (!response.ok) {
        throw new Error(String(response.status));
      }
      setContent(await response.text());
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [attachment.url]);

  const toggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    if (next && content === null && !isLoading) {
      void load();
    }
  }, [content, isLoading, load, open]);

  if (!isTxt) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-2" data-testid="text-attachment-preview">
      <button
        className={cn(
          "flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground",
          align === "right" && "self-end"
        )}
        data-testid="text-attachment-preview-toggle"
        onClick={toggle}
        type="button"
      >
        {open ? (
          <ChevronUpIcon aria-hidden="true" className="size-3.5" />
        ) : (
          <ChevronDownIcon aria-hidden="true" className="size-3.5" />
        )}
        {open ? t("hideTextPreview") : t("previewTextContent")}
      </button>

      {open ? (
        <div
          className={cn(
            "max-h-72 w-full overflow-auto rounded-xl border border-border/40 bg-muted/40 p-3",
            align === "right" && "self-end"
          )}
        >
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              {t("textPreviewLoading")}
            </div>
          ) : hasError ? (
            <p className="text-sm text-destructive">{t("textPreviewLoadFailed")}</p>
          ) : (
            // whitespace-pre-wrap 按原文保留换行，break-words 兜底超长行
            <pre className="font-sans text-sm leading-6 break-words whitespace-pre-wrap">
              {content}
            </pre>
          )}
        </div>
      ) : null}
    </div>
  );
}
