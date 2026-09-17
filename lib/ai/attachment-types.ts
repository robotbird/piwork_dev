export const MAX_CHAT_ATTACHMENT_COUNT = 5;
export const MAX_CHAT_ATTACHMENT_SIZE = 20 * 1024 * 1024;

const ATTACHMENT_TYPES = {
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  drawio: "application/vnd.jgraph.mxfile",
  epub: "application/epub+zip",
  gif: "image/gif",
  htm: "text/html",
  html: "text/html",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  json: "application/json",
  md: "text/markdown",
  odp: "application/vnd.oasis.opendocument.presentation",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odt: "application/vnd.oasis.opendocument.text",
  pdf: "application/pdf",
  png: "image/png",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  rtf: "application/rtf",
  svg: "image/svg+xml",
  txt: "text/plain",
  webp: "image/webp",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xml: "application/xml",
  yaml: "application/yaml",
  yml: "application/yaml",
} as const;

export type SupportedAttachmentExtension = keyof typeof ATTACHMENT_TYPES;

export const CHAT_ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_TYPES)
  .map((extension) => `.${extension}`)
  .join(",");

export const SUPPORTED_ATTACHMENT_LABEL =
  "图片、PDF、Word、Excel、PowerPoint、OpenDocument、RTF、EPUB、Draw.io、文本与网页文件";

export function getAttachmentExtension(filename: string) {
  return filename.toLocaleLowerCase().split(".").at(-1) ?? "";
}

export function getSupportedAttachmentType(filename: string) {
  const extension = getAttachmentExtension(
    filename
  ) as SupportedAttachmentExtension;
  const mediaType = ATTACHMENT_TYPES[extension];

  return mediaType ? { extension, mediaType } : null;
}

export function isSupportedAttachmentMediaType(mediaType: string) {
  return (Object.values(ATTACHMENT_TYPES) as readonly string[]).includes(
    mediaType
  );
}

export function isVisionAttachment(mediaType: string) {
  return ["image/gif", "image/jpeg", "image/png", "image/webp"].includes(
    mediaType
  );
}
