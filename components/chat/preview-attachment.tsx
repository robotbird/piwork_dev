"use client";

import {
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PresentationIcon,
  WorkflowIcon,
} from "lucide-react";
import Image from "next/image";
import { isChatFileUrl, isVisionAttachment } from "@/lib/ai/attachment-types";
import type { Attachment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePreferences } from "../preferences-provider";
import { Spinner } from "../ui/spinner";
import { CrossSmallIcon, DownloadIcon } from "./icons";

export const PreviewAttachment = ({
  attachment,
  composer = false,
  downloadHref,
  isUploading = false,
  onRemove,
}: {
  attachment: Attachment;
  composer?: boolean;
  downloadHref?: string;
  isUploading?: boolean;
  onRemove?: () => void;
}) => {
  const { t } = usePreferences();
  const { name, url, contentType } = attachment;
  const extension = name?.split(".").at(-1)?.toLocaleUpperCase() ?? "FILE";
  const FileTypeIcon =
    extension === "XLSX" || extension === "ODS" || extension === "CSV"
      ? FileSpreadsheetIcon
      : extension === "PPTX" || extension === "ODP"
        ? PresentationIcon
        : extension === "DRAWIO"
          ? WorkflowIcon
          : ["DOCX", "ODT", "PDF", "RTF", "TXT", "MD"].includes(extension)
            ? FileTextIcon
            : FileIcon;

  const isImage = isVisionAttachment(contentType ?? "");

  return (
    <div
      className={cn(
        "group relative shrink-0 overflow-hidden rounded-xl border border-border/40 bg-muted",
        composer
          ? isImage
            ? "size-32 sm:size-36"
            : "flex h-14 max-w-full items-center"
          : "h-24 w-24"
      )}
      data-testid="input-attachment-preview"
    >
      {isImage ? (
        <Image
          alt={name ?? t("chat.attachment")}
          className="size-full object-cover"
          height={composer ? 144 : 96}
          // 本地存储的 /api/files/* 需要会话 cookie，图片优化器的内部
          // fetch 不携带 cookie 会得到 401，因此跳过优化直接渲染。
          src={url}
          unoptimized={isChatFileUrl(url)}
          width={composer ? 144 : 96}
        />
      ) : (
        <div
          className={cn(
            "flex text-muted-foreground",
            composer
              ? "min-w-0 items-center gap-3 py-3 pl-3 pr-10"
              : "size-full flex-col items-center justify-center gap-1.5 px-2"
          )}
        >
          <FileTypeIcon
            className={cn("shrink-0", composer ? "size-5" : "size-7")}
          />
          {composer ? null : (
            <span className="max-w-full truncate text-[10px] font-medium">
              {extension}
            </span>
          )}
          <span
            className={cn(
              "truncate",
              composer
                ? "max-w-80 text-sm text-foreground"
                : "max-w-full text-[10px]"
            )}
            title={name}
          >
            {name}
          </span>
        </div>
      )}

      {isUploading ? (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-sm"
          data-testid="input-attachment-loader"
        >
          <Spinner className="size-5" />
        </div>
      ) : null}

      {onRemove && !isUploading && (
        <button
          aria-label={t("chat.removeAttachment")}
          className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-100 backdrop-blur-sm transition-opacity hover:bg-black/80 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          onClick={onRemove}
          type="button"
        >
          <CrossSmallIcon size={10} />
        </button>
      )}

      {downloadHref && !isUploading && (
        <a
          aria-label={t("chat.download")}
          className="absolute bottom-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/80 group-hover:opacity-100"
          download={attachment.name}
          href={downloadHref}
        >
          <DownloadIcon size={10} />
        </a>
      )}
    </div>
  );
};
