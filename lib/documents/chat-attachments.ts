import {
  getSupportedAttachmentType,
  MAX_CHAT_ATTACHMENT_SIZE,
} from "@/lib/ai/attachment-types";
import type { LibraryItem } from "./types";

export function libraryAttachmentType(
  item: Pick<LibraryItem, "kind" | "name" | "size" | "contentType">
) {
  if (item.kind !== "file" || item.size > MAX_CHAT_ATTACHMENT_SIZE) {
    return null;
  }
  // Notes may have text/plain metadata but a .md filename. The existing
  // attachment parser requires the canonical MIME belonging to the extension.
  return getSupportedAttachmentType(item.name);
}

export function searchLibraryFiles(items: LibraryItem[], query: string) {
  const needle = query.trim().toLocaleLowerCase();
  return items
    .filter(
      (item) =>
        item.kind === "file" && item.name.toLocaleLowerCase().includes(needle)
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
