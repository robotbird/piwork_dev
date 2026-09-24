"use client";

import {
  BookOpenTextIcon,
  ChevronRightIcon,
  FileCodeIcon,
  FileImageIcon,
  FileTextIcon,
  FolderIcon,
} from "lucide-react";
import {
  type ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type SkillBrowseTarget = {
  description: string;
  displayName: string;
  name: string;
  source: "catalog" | "upload";
  version: string;
};

type SkillFileEntry = {
  kind: "file" | "directory";
  name: string;
  path: string;
  size: number;
};

type SkillFileContent = {
  content: string;
  encoding: "base64" | "text";
  mimeType: string;
  path: string;
  size: number;
  truncated: boolean;
};

type TreeFolder = {
  kind: "directory";
  name: string;
  path: string;
  children: TreeItem[];
};

type TreeFile = {
  kind: "file";
  name: string;
  path: string;
  size: number;
};

type TreeItem = TreeFolder | TreeFile;

const CODE_EXTENSIONS = [
  ".css",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".mdx",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".toml",
  ".ts",
  ".tsx",
  ".xml",
  ".yaml",
  ".yml",
];

function fileIcon(entry: TreeFile): ComponentType<{ className?: string }> {
  const path = entry.path.toLocaleLowerCase();
  if (/\.(gif|ico|jpeg|jpg|png|svg|webp)$/.test(path)) {
    return FileImageIcon;
  }
  if (CODE_EXTENSIONS.some((extension) => path.endsWith(extension))) {
    return FileCodeIcon;
  }
  return FileTextIcon;
}

function isMarkdownFile(path: string) {
  return path.toLocaleLowerCase().endsWith(".md");
}

function stripMarkdownFrontmatter(content: string) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function buildTree(entries: SkillFileEntry[]): TreeItem[] {
  const root: TreeFolder = {
    children: [],
    kind: "directory",
    name: "",
    path: "",
  };
  const folders = new Map<string, TreeFolder>([["", root]]);

  const ensureFolder = (path: string, name: string): TreeFolder => {
    const existing = folders.get(path);
    if (existing) {
      return existing;
    }
    const parentPath = path.includes("/")
      ? path.slice(0, path.lastIndexOf("/"))
      : "";
    const folder: TreeFolder = { children: [], kind: "directory", name, path };
    folders.set(path, folder);
    ensureFolder(parentPath, parentPath.split("/").at(-1) ?? "").children.push(
      folder
    );
    return folder;
  };

  for (const entry of entries) {
    if (entry.kind === "directory") {
      ensureFolder(entry.path, entry.name);
    } else {
      const parentPath = entry.path.includes("/")
        ? entry.path.slice(0, entry.path.lastIndexOf("/"))
        : "";
      ensureFolder(
        parentPath,
        parentPath.split("/").at(-1) ?? ""
      ).children.push({
        kind: "file",
        name: entry.name,
        path: entry.path,
        size: entry.size,
      });
    }
  }

  const sortItems = (items: TreeItem[]): TreeItem[] => {
    const sorted = [...items].sort((left, right) =>
      left.name.localeCompare(right.name)
    );
    return [
      ...sorted.filter((item) => item.kind === "directory"),
      ...sorted.filter((item) => item.kind === "file"),
    ].map((item) =>
      item.kind === "directory"
        ? { ...item, children: sortItems(item.children) }
        : item
    );
  };

  return sortItems(root.children);
}

function formatSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function SkillContentBrowser({
  onOpenChange,
  skill,
}: {
  onOpenChange: (open: boolean) => void;
  skill: SkillBrowseTarget | null;
}) {
  const { t } = usePreferences();
  const [tree, setTree] = useState<TreeItem[] | null>(null);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [file, setFile] = useState<SkillFileContent | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    () => new Set()
  );
  const fileCache = useRef(new Map<string, SkillFileContent>());

  const endpoint = skill
    ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/management/skills/${encodeURIComponent(skill.name)}`
    : null;
  const treeRequestRef = useRef<{ cancelled: boolean } | null>(null);

  const loadTree = useCallback(() => {
    if (!endpoint) {
      return;
    }
    if (treeRequestRef.current) {
      treeRequestRef.current.cancelled = true;
    }
    const request = { cancelled: false };
    treeRequestRef.current = request;

    fileCache.current.clear();
    setTree(null);
    setTreeError(null);
    setSelectedPath(null);
    setFile(null);
    setFileError(null);
    setCollapsedFolders(new Set());

    (async () => {
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        const data = (await response.json()) as {
          entries?: SkillFileEntry[];
          error?: string;
        };
        if (request.cancelled) {
          return;
        }
        if (!response.ok || !data.entries) {
          throw new Error(data.error || t("skills.failedToLoadTheFileList"));
        }
        setTree(buildTree(data.entries));
        const manifest = data.entries.find(
          (entry) => entry.path === "SKILL.md"
        );
        if (manifest) {
          setSelectedPath(manifest.path);
        }
      } catch (error) {
        if (!request.cancelled) {
          setTreeError(
            error instanceof Error
              ? error.message
              : t("skills.failedToLoadTheFileList")
          );
        }
      }
    })();
  }, [endpoint, t]);

  useEffect(() => {
    if (!skill) {
      return;
    }
    loadTree();
    return () => {
      if (treeRequestRef.current) {
        treeRequestRef.current.cancelled = true;
      }
    };
  }, [loadTree, skill]);

  useEffect(() => {
    if (!endpoint || !selectedPath) {
      return;
    }

    const cached = fileCache.current.get(selectedPath);
    if (cached) {
      setFile(cached);
      setFileError(null);
      return;
    }

    let cancelled = false;
    setLoadingFile(true);
    setFile(null);
    setFileError(null);

    (async () => {
      try {
        const response = await fetch(
          `${endpoint}?path=${encodeURIComponent(selectedPath)}`,
          { cache: "no-store" }
        );
        const data = (await response.json()) as {
          file?: SkillFileContent;
          error?: string;
        };
        if (cancelled) {
          return;
        }
        if (!response.ok || !data.file) {
          throw new Error(data.error || t("skills.failedToLoadThisFile"));
        }
        fileCache.current.set(selectedPath, data.file);
        setFile(data.file);
      } catch (error) {
        if (!cancelled) {
          setFileError(
            error instanceof Error
              ? error.message
              : t("skills.failedToLoadThisFile")
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingFile(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [endpoint, selectedPath, t]);

  const handleSelect = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setSelectedPath(event.currentTarget.dataset.path ?? null);
    },
    []
  );

  const handleToggleFolder = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const path = event.currentTarget.dataset.folderPath ?? "";
      setCollapsedFolders((current) => {
        const next = new Set(current);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
    },
    []
  );

  const handleRetryTree = useCallback(() => loadTree(), [loadTree]);

  const fileCount = useMemo(() => countFiles(tree), [tree]);

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(skill)}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden bg-card p-0 sm:max-w-4xl">
        {skill ? (
          <>
            <DialogHeader className="flex-row items-start gap-3 border-b border-border px-6 py-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-primary">
                <BookOpenTextIcon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <DialogTitle className="truncate text-[15px] font-medium">
                    {skill.displayName}
                  </DialogTitle>
                  <span className="shrink-0 rounded-md bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    /{skill.name}
                  </span>
                </div>
                <DialogDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span>
                    {skill.source === "catalog"
                      ? t("skills.officialCatalog")
                      : t("skills.uploaded")}
                  </span>
                  {skill.version ? (
                    <span className="font-mono">v{skill.version}</span>
                  ) : null}
                  {fileCount > 0 ? (
                    <span>{t("skills.files", { count: fileCount })}</span>
                  ) : null}
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
              <aside
                aria-label={t("skills.skillFiles")}
                className="min-h-0 shrink-0 border-b border-border sm:w-60 sm:border-b-0 sm:border-r"
              >
                <div className="h-full max-h-48 overflow-y-auto px-2 py-3 sm:max-h-none">
                  {treeError ? (
                    <div className="px-2 py-6 text-center">
                      <p className="text-[13px] text-muted-foreground">
                        {treeError}
                      </p>
                      <Button
                        className="mt-3"
                        onClick={handleRetryTree}
                        size="sm"
                        variant="outline"
                      >
                        {t("common.retry")}
                      </Button>
                    </div>
                  ) : tree ? (
                    <ul className="space-y-0.5">
                      {tree.map((item) => (
                        <li key={item.path}>
                          <TreeItemView
                            collapsedFolders={collapsedFolders}
                            item={item}
                            level={0}
                            onSelect={handleSelect}
                            onToggleFolder={handleToggleFolder}
                            selectedPath={selectedPath}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-muted-foreground">
                      <Spinner className="size-3.5" />
                      {t("common.loading")}
                    </div>
                  )}
                </div>
              </aside>

              <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
                {loadingFile ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                    <Spinner className="size-4" />
                    {t("common.loading")}
                  </div>
                ) : fileError ? (
                  <div className="px-6 py-16 text-center text-sm text-muted-foreground">
                    {fileError}
                  </div>
                ) : file ? (
                  <FilePreview file={file} />
                ) : (
                  <div className="px-6 py-16 text-center text-sm text-muted-foreground">
                    {t("skills.selectAFileToPreviewIt")}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function countFiles(items: TreeItem[] | null): number {
  if (!items) {
    return 0;
  }
  return items.reduce(
    (total, item) =>
      item.kind === "file" ? total + 1 : total + countFiles(item.children),
    0
  );
}

function TreeItemView({
  collapsedFolders,
  item,
  level,
  onToggleFolder,
  onSelect,
  selectedPath,
}: {
  collapsedFolders: Set<string>;
  item: TreeItem;
  level: number;
  onToggleFolder: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void;
  selectedPath: string | null;
}) {
  const paddingLeft = 8 + level * 16;

  if (item.kind === "directory") {
    const collapsed = collapsedFolders.has(item.path);
    return (
      <div>
        <button
          className="flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-left text-[13px] text-foreground transition-colors hover:bg-muted"
          data-folder-path={item.path}
          onClick={onToggleFolder}
          style={{ paddingLeft }}
          type="button"
        >
          <ChevronRightIcon
            aria-hidden="true"
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              !collapsed && "rotate-90"
            )}
          />
          <FolderIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="truncate">{item.name}</span>
        </button>
        {collapsed ? null : (
          <ul className="space-y-0.5">
            {item.children.map((child) => (
              <li key={child.path}>
                <TreeItemView
                  collapsedFolders={collapsedFolders}
                  item={child}
                  level={level + 1}
                  onSelect={onSelect}
                  onToggleFolder={onToggleFolder}
                  selectedPath={selectedPath}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const selected = selectedPath === item.path;
  const Icon = fileIcon(item);

  return (
    <button
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-left text-[13px] transition-colors",
        selected
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      data-path={item.path}
      onClick={onSelect}
      style={{ paddingLeft: paddingLeft + 18 }}
      title={item.path}
      type="button"
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{item.name}</span>
    </button>
  );
}

function FilePreview({ file }: { file: SkillFileContent }) {
  const { t } = usePreferences();

  if (file.encoding === "text") {
    if (isMarkdownFile(file.path)) {
      return (
        <div className="px-6 py-5">
          {file.truncated ? (
            <p className="mb-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {t("skills.thisFileIsLargeAndHasBeen")}
            </p>
          ) : null}
          <MessageResponse className="text-sm">
            {stripMarkdownFrontmatter(file.content)}
          </MessageResponse>
        </div>
      );
    }

    return (
      <div className="px-6 py-5">
        <p className="mb-3 font-mono text-[11px] text-muted-foreground">
          {file.path} · {formatSize(file.size)}
          {file.truncated ? ` · ${t("skills.thisFileIsLargeAndHasBeen")}` : ""}
        </p>
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-[13px] leading-5 text-foreground">
          {file.content}
        </pre>
      </div>
    );
  }

  if (file.mimeType.startsWith("image/")) {
    return (
      <div className="px-6 py-5">
        <p className="mb-3 font-mono text-[11px] text-muted-foreground">
          {file.path} · {formatSize(file.size)}
        </p>
        {/* biome-ignore lint/performance/noImgElement: data URI 预览，无需 next/image 优化 */}
        <img
          alt={file.path}
          className="max-w-full rounded-lg border border-border bg-card"
          src={`data:${file.mimeType};base64,${file.content}`}
        />
      </div>
    );
  }

  return (
    <div className="px-6 py-16 text-center">
      <p className="text-sm text-muted-foreground">
        {t("skills.thisFileTypeCanTBePreviewed")}
      </p>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
        {file.path} · {formatSize(file.size)}
      </p>
    </div>
  );
}
