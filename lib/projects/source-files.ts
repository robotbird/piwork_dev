import type { SupportedAttachmentExtension } from "@/lib/ai/attachment-types";
import { extractAttachmentText } from "@/lib/ai/attachments";

/** MVP 来源文件类型：PDF / TXT / Markdown */
export const SOURCE_TYPES = ["pdf", "txt", "markdown"] as const;
export type SourceFileType = (typeof SOURCE_TYPES)[number];

const EXTENSION_TO_TYPE: Record<string, SourceFileType> = {
  md: "markdown",
  pdf: "pdf",
  txt: "txt",
};

const TYPE_TO_EXTENSION: Record<SourceFileType, SupportedAttachmentExtension> =
  {
    markdown: "md",
    pdf: "pdf",
    txt: "txt",
  };

export function sourceTypeFromFilename(
  filename: string
): SourceFileType | null {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TO_TYPE[extension] ?? null;
}

export function sourceTypeLabel(type: SourceFileType): string {
  if (type === "pdf") {
    return "PDF";
  }
  if (type === "markdown") {
    return "Markdown";
  }
  return "TXT";
}

/** 提取来源文本：复用聊天附件的解析管线（officeparser 支持 pdf/md/txt） */
export function extractSourceText({
  content,
  type,
  signal,
}: {
  content: Uint8Array;
  type: SourceFileType;
  signal?: AbortSignal;
}): Promise<string> {
  return extractAttachmentText({
    content,
    extension: TYPE_TO_EXTENSION[type],
    signal,
  });
}
