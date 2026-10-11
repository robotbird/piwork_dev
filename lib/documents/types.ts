export type LibraryItem = {
  id: string;
  parentId: string | null;
  name: string;
  kind: "folder" | "file";
  source: "upload" | "ai" | "manual";
  contentType: string | null;
  size: number;
  createdAt: string;
  updatedAt: string;
};

export function fileCategory(name: string, contentType: string | null) {
  const ext = name.toLowerCase().split(".").pop();
  if (contentType?.startsWith("image/")) {
    return "images";
  }
  if (["csv", "xls", "xlsx", "ods"].includes(ext ?? "")) {
    return "spreadsheets";
  }
  if (["ppt", "pptx", "odp"].includes(ext ?? "")) {
    return "presentations";
  }
  return "documents";
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
