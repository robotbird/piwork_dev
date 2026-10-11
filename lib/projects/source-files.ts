import type { ImageContent } from "@earendil-works/pi-ai";
import {
  CHAT_ATTACHMENT_ACCEPT,
  getSupportedAttachmentType,
  isVisionAttachment,
  type SupportedAttachmentExtension,
} from "@/lib/ai/attachment-types";
import { extractDocumentText } from "@/lib/ai/attachments";

export const SOURCE_ACCEPT = CHAT_ATTACHMENT_ACCEPT;
export type SourceFileType = SupportedAttachmentExtension | "markdown";
export const MAX_PROJECT_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_PROJECT_IMAGES = 5;

export function sourceTypeFromFilename(
  filename: string
): SourceFileType | null {
  const supported = getSupportedAttachmentType(filename);
  return supported?.extension === "md"
    ? "markdown"
    : (supported?.extension ?? null);
}

export function sourceTypeLabel(type: string): string {
  return type === "markdown" || type === "md" ? "Markdown" : type.toUpperCase();
}

export function sourceImageMime(type: string): string | null {
  const supported = getSupportedAttachmentType(`source.${type}`);
  return supported && isVisionAttachment(supported.mediaType)
    ? supported.mediaType
    : null;
}

function matchesImageSignature(bytes: Uint8Array, mime: string): boolean {
  const b = Buffer.from(bytes);
  if (mime === "image/png") {
    return b
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mime === "image/jpeg") {
    return b[0] === 255 && b[1] === 216 && b[2] === 255;
  }
  if (mime === "image/gif") {
    return ["GIF87a", "GIF89a"].includes(b.subarray(0, 6).toString("ascii"));
  }
  return (
    b.subarray(0, 4).toString("ascii") === "RIFF" &&
    b.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

/** 图片保存为版本化载荷，不走文本截断或宿主 OCR。 */
export function encodeSourceImage(
  content: Uint8Array,
  type: SourceFileType
): string {
  const mime = sourceImageMime(type);
  if (
    !mime ||
    !content.length ||
    content.length > MAX_PROJECT_IMAGE_BYTES ||
    !matchesImageSignature(content, mime)
  ) {
    throw new Error("Invalid project image or image exceeds 8 MB.");
  }
  return JSON.stringify({
    data: Buffer.from(content).toString("base64"),
    version: 1,
  });
}

export function decodeSourceImage(content: string, type: string): ImageContent {
  const payload = JSON.parse(content);
  const mimeType = sourceImageMime(type);
  if (
    !mimeType ||
    !payload ||
    payload.version !== 1 ||
    typeof payload.data !== "string" ||
    payload.data.length > Math.ceil(MAX_PROJECT_IMAGE_BYTES / 3) * 4 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(payload.data)
  ) {
    throw new Error("Invalid project image payload.");
  }
  const bytes = Buffer.from(payload.data, "base64");
  encodeSourceImage(bytes, type as SourceFileType);
  return {
    data: bytes.toString("base64"),
    mimeType,
    type: "image",
  };
}

export function extractSourceText({
  content,
  type,
  signal,
}: {
  content: Uint8Array;
  type: SourceFileType;
  signal?: AbortSignal;
}): Promise<string> {
  if (sourceImageMime(type)) {
    return Promise.resolve(encodeSourceImage(content, type));
  }
  return extractDocumentText({
    content,
    extension: type === "markdown" ? "md" : type,
    signal,
  });
}
