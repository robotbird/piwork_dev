// biome-ignore-all lint/performance/noJsxPropsBind: React Compiler memoizes this view; row actions bind their own document.
"use client";

import {
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Folder,
  Grid2X2,
  ImageIcon,
  List,
  Loader2,
  MoreHorizontal,
  Plus,
  Presentation,
  Search,
  Sheet,
  Sparkles,
  Upload,
} from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { MAX_CHAT_ATTACHMENT_SIZE } from "@/lib/ai/attachment-types";
import {
  fileCategory,
  formatFileSize,
  type LibraryItem,
} from "@/lib/documents/types";
import { cn } from "@/lib/utils";
import styles from "./document-library.module.css";

const tabs = ["全部", "文件夹", "文档", "图片", "表格", "演示", "AI 生成"];
const dateLabel = (value: string) =>
  new Date(value).toLocaleString("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
async function requestJSON(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "操作失败，请重试");
  }
  return response.json();
}
function fileStyle(item: LibraryItem) {
  const category = fileCategory(item.name, item.contentType);
  if (category === "图片") {
    return {
      color: "text-violet-500 bg-violet-50 dark:bg-violet-950/30",
      Icon: ImageIcon,
      label: "IMAGE",
    };
  }
  if (category === "表格") {
    return {
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
      Icon: Sheet,
      label: "SHEET",
    };
  }
  if (category === "演示") {
    return {
      color: "text-orange-500 bg-orange-50 dark:bg-orange-950/30",
      Icon: Presentation,
      label: "SLIDES",
    };
  }
  return {
    color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30",
    Icon: FileText,
    label: item.name.split(".").pop()?.toUpperCase() ?? "FILE",
  };
}

export function DocumentLibrary() {
  const {
    data: items = [],
    error,
    isLoading,
    mutate,
  } = useSWR<LibraryItem[]>("/api/library", requestJSON, {
    refreshInterval: 15_000,
  });
  const [tab, setTab] = useState("全部");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [parentId, setParentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dialog, setDialog] = useState<{
    mode: "folder" | "rename" | "note" | "move";
    item?: LibraryItem;
  } | null>(null);
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState<LibraryItem | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const scoped = items.filter((item) =>
    search
      ? item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())
      : item.parentId === parentId
  );
  const folders = scoped.filter(
    (item) => item.kind === "folder" && ["全部", "文件夹"].includes(tab)
  );
  const files = scoped.filter(
    (item) =>
      item.kind === "file" &&
      (tab === "全部" ||
        (tab === "AI 生成"
          ? item.source === "ai"
          : fileCategory(item.name, item.contentType) === tab))
  );
  const breadcrumbs: LibraryItem[] = [];
  let current = items.find((item) => item.id === parentId);
  while (current && !breadcrumbs.some((item) => item.id === current?.id)) {
    breadcrumbs.unshift(current);
    current = items.find((item) => item.id === current?.parentId);
  }
  function navigate(id: string | null) {
    setParentId(id);
    setSearch("");
    setTab("全部");
  }
  function openDialog(
    mode: "folder" | "rename" | "note" | "move",
    item?: LibraryItem
  ) {
    setName(item?.name ?? "");
    setContent("");
    setDestination(item?.parentId ?? "");
    setDialog({ item, mode });
  }
  async function upload(file: File) {
    if (file.size > MAX_CHAT_ATTACHMENT_SIZE) {
      throw new Error(`${file.name} 超过 20 MB 限制`);
    }
    const form = new FormData();
    form.append("file", file);
    form.append("library", "true");
    if (parentId) {
      form.append("parentId", parentId);
    }
    await requestJSON("/api/files/upload", { body: form, method: "POST" });
  }
  async function uploadFiles(selected: File[]) {
    if (busy || !selected.length) {
      return;
    }
    setBusy(true);
    let success = 0;
    for (const file of selected) {
      try {
        // biome-ignore lint/performance/noAwaitInLoops: bound upload memory and report each file failure independently.
        await upload(file);
        success += 1;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "上传失败");
      }
    }
    if (success) {
      toast.success(`已归档 ${success} 个文件`);
    }
    await mutate();
    setBusy(false);
  }
  async function submit() {
    if (!name.trim() || !dialog) {
      return;
    }
    setBusy(true);
    try {
      if (dialog.mode === "note") {
        await upload(
          new File(
            [content],
            name.trim().endsWith(".md") ? name.trim() : `${name.trim()}.md`,
            { type: "text/markdown" }
          )
        );
      } else {
        await requestJSON(
          dialog.mode === "folder"
            ? "/api/library"
            : `/api/library/${dialog.item?.id}`,
          {
            body: JSON.stringify(
              dialog.mode === "move"
                ? { parentId: destination || null }
                : dialog.mode === "folder"
                  ? { name: name.trim(), parentId }
                  : { name: name.trim() }
            ),
            headers: { "Content-Type": "application/json" },
            method: dialog.mode === "folder" ? "POST" : "PATCH",
          }
        );
      }
      setDialog(null);
      await mutate();
      toast.success("已保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }
  function actions(item: LibraryItem) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`${item.name}的操作`}
            className="size-8 shrink-0 text-muted-foreground"
            size="icon"
            variant="ghost"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openDialog("rename", item)}>
            重命名
          </DropdownMenuItem>
          {item.kind === "file" && (
            <DropdownMenuItem onClick={() => openDialog("move", item)}>
              移动到文件夹
            </DropdownMenuItem>
          )}
          {item.kind === "file" && (
            <DropdownMenuItem asChild>
              <a download href={`/api/library/${item.id}`}>
                <Download className="mr-2 size-4" />
                下载文件
              </a>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: drag/drop supplements the keyboard-accessible upload button.
    <main
      className={cn("relative", styles.page)}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setDragging(false);
        }
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          setDragging(true);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        uploadFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <header className={styles.header}>
        <div>
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden" />
            <h1 className={styles.heading}>我的文档</h1>
          </div>
          <p className={styles.subtitle}>
            上传的各类文件，以及 AI 生成的文档和图片，统一存储与管理。
          </p>
        </div>
        <div className={styles.toolbar}>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              aria-label="网格视图"
              aria-pressed={view === "grid"}
              className={cn("rounded-full", view === "grid" && "bg-muted")}
              onClick={() => setView("grid")}
              size="icon"
              variant="ghost"
            >
              <Grid2X2 className="size-5" />
            </Button>
            <Button
              aria-label="列表视图"
              aria-pressed={view === "list"}
              className={cn("rounded-full", view === "list" && "bg-muted")}
              onClick={() => setView("list")}
              size="icon"
              variant="ghost"
            >
              <List className="size-5" />
            </Button>
          </div>
          <label className={styles.search}>
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              aria-label="搜索文档"
              className="w-full bg-transparent text-sm outline-none"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索所有文档"
              value={search}
            />
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="h-[42px] shrink-0 rounded-full px-5 text-[13px] shadow-none"
                disabled={busy}
              >
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {busy ? "上传中" : "新建"}
                <ChevronDown className="ml-2 size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-2xl border-border bg-card p-2.5 shadow-lg [&_[role=menuitem]]:gap-2 [&_[role=menuitem]]:rounded-lg [&_[role=menuitem]]:px-3 [&_[role=menuitem]]:py-2.5"
            >
              <DropdownMenuItem onClick={() => openDialog("note")}>
                <FileText className="mr-2 size-4" />
                笔记
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openDialog("folder")}>
                <Folder className="mr-2 size-4" />
                文件夹
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => input.current?.click()}>
                <Upload className="mr-2 size-4" />
                上传文件
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            aria-label="选择上传文件"
            className="hidden"
            multiple
            onChange={(event) => {
              uploadFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
            ref={input}
            type="file"
          />
        </div>
      </header>
      <nav aria-label="文档分类" className={styles.tabs}>
        {tabs.map((label) => (
          <button
            aria-pressed={tab === label}
            className={cn(
              "shrink-0 rounded-full px-[18px] py-2 text-[14px] leading-5 transition-colors",
              tab === label
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60"
            )}
            key={label}
            onClick={() => setTab(label)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>
      {parentId && !search && (
        <nav
          aria-label="文件夹路径"
          className="mt-5 flex flex-wrap items-center gap-2 text-sm"
        >
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={() => navigate(null)}
            type="button"
          >
            我的文档
          </button>
          {breadcrumbs.map((folder) => (
            <span className="flex items-center gap-2" key={folder.id}>
              <ChevronRight className="size-3 text-muted-foreground" />
              <button onClick={() => navigate(folder.id)} type="button">
                {folder.name}
              </button>
            </span>
          ))}
        </nav>
      )}
      {error ? (
        <div className="mt-12 rounded-xl border p-8 text-center" role="alert">
          <p>文档加载失败，请重试。</p>
          <Button className="mt-4" onClick={() => mutate()} variant="outline">
            重新加载
          </Button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-5 pt-10 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div className="h-52 animate-pulse rounded-2xl bg-muted" key={n} />
          ))}
        </div>
      ) : (
        <>
          {folders.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                文件夹{" "}
                <span className="ml-1 font-normal text-muted-foreground">
                  ({folders.length})
                </span>
              </h2>
              <div className={styles.folderGrid}>
                {folders.map((folder, index) => (
                  <div className={styles.folderCard} key={folder.id}>
                    <button
                      className="flex min-w-0 flex-1 items-center gap-4 text-left"
                      onClick={() => navigate(folder.id)}
                      type="button"
                    >
                      <Folder
                        className={cn(
                          "size-11 shrink-0 stroke-[1.2]",
                          [
                            "fill-blue-400 text-blue-500",
                            "fill-violet-400 text-violet-500",
                            "fill-amber-300 text-amber-400",
                          ][index % 3]
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {folder.name}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {
                            items.filter(
                              (item) =>
                                item.parentId === folder.id &&
                                item.kind === "file"
                            ).length
                          }{" "}
                          个文件 ·{" "}
                          {
                            items.filter(
                              (item) =>
                                item.parentId === folder.id &&
                                item.kind === "folder"
                            ).length
                          }{" "}
                          个子文件夹
                        </span>
                      </span>
                    </button>
                    {actions(folder)}
                  </div>
                ))}
              </div>
            </section>
          )}
          {files.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                {search ? "搜索结果" : "最近文件"}{" "}
                <span className="ml-1 font-normal text-muted-foreground">
                  ({files.length})
                </span>
              </h2>
              <div
                className={view === "grid" ? styles.fileGrid : styles.fileList}
              >
                {view === "list" && (
                  <div aria-hidden="true" className={styles.listHeader}>
                    <span>文件名称</span>
                    <span>大小</span>
                    <span>更新时间</span>
                    <span>来源</span>
                    <span />
                  </div>
                )}
                {files.map((item) => {
                  const { Icon, color, label } = fileStyle(item);
                  const image = [
                    "image/png",
                    "image/jpeg",
                    "image/webp",
                    "image/gif",
                  ].includes(item.contentType ?? "");
                  return (
                    <article
                      className={cn(
                        "group",
                        view === "grid" ? styles.card : styles.row
                      )}
                      key={item.id}
                    >
                      {view === "grid" && (
                        <button
                          aria-label={
                            image ? `预览 ${item.name}` : `下载 ${item.name}`
                          }
                          className={cn(styles.preview, color)}
                          onClick={() => {
                            if (image) {
                              setPreview(item);
                            } else {
                              window.location.assign(`/api/library/${item.id}`);
                            }
                          }}
                          type="button"
                        >
                          {image ? (
                            <Image
                              alt={item.name}
                              className="size-full object-cover transition-transform group-hover:scale-[1.03]"
                              height={700}
                              loading="lazy"
                              src={`/api/library/${item.id}?preview=1`}
                              unoptimized
                              width={1000}
                            />
                          ) : (
                            <div className={styles.cover}>
                              <Icon className={styles.coverIcon} />
                              <span className={styles.coverLabel}>{label}</span>
                            </div>
                          )}
                          {item.source === "ai" && (
                            <span className={styles.aiBadge}>AI 生成</span>
                          )}
                        </button>
                      )}
                      <div className={styles.fileInfo}>
                        <span
                          className={cn(
                            "mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-[5px]",
                            color
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <div className={styles.fileDetails}>
                          <a
                            className={cn(styles.fileName, "hover:underline")}
                            download
                            href={`/api/library/${item.id}`}
                            title={item.name}
                          >
                            {item.name}
                          </a>
                          <p className={styles.meta}>
                            <span>
                              {item.size ? formatFileSize(item.size) : "—"}
                            </span>
                            <span className={styles.metaDot}>·</span>
                            <span>{dateLabel(item.updatedAt)}</span>
                          </p>
                        </div>
                        {view === "list" && (
                          <span
                            className={cn(
                              styles.listSource,
                              item.source === "ai" && styles.listSourceAi
                            )}
                          >
                            {item.source === "ai" ? "AI 生成" : "我的文件"}
                          </span>
                        )}
                        {actions(item)}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          {!folders.length && !files.length && (
            <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
              <div className="mb-5 grid size-16 place-items-center rounded-2xl bg-muted">
                <Folder className="size-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-medium">
                {search ? "没有找到匹配的文档" : "这里还没有文件"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {search
                  ? "试试其他文件名或分类。"
                  : "拖入文件或点击上传。聊天附件和 AI 交付的文件也会自动保存在这里。"}
              </p>
              {!search && (
                <Button
                  className="mt-6 rounded-full"
                  disabled={busy}
                  onClick={() => input.current?.click()}
                >
                  <Plus className="mr-2 size-4" />
                  上传文件
                </Button>
              )}
            </div>
          )}
        </>
      )}
      <p className={styles.hint}>
        <Sparkles className="size-3.5" />
        支持任意类型文件，单个文件最大 20 MB；AI 交付文件最大 50 MB。
      </p>
      {dragging === true && (
        <div className="pointer-events-none absolute inset-3 z-40 grid place-items-center rounded-2xl border-2 border-dashed border-blue-400 bg-background/95">
          <div className="text-center">
            <Upload className="mx-auto mb-4 size-10 text-blue-500" />
            <p className="text-xl font-medium">拖放到此处，保存到当前文件夹</p>
          </div>
        </div>
      )}
      <Dialog
        onOpenChange={(open) => {
          if (!open && !busy) {
            setDialog(null);
          }
        }}
        open={Boolean(dialog)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "move"
                ? "移动到文件夹"
                : dialog?.mode === "rename"
                  ? "重命名"
                  : dialog?.mode === "note"
                    ? "新建笔记"
                    : "新建文件夹"}
            </DialogTitle>
            <DialogDescription>
              {dialog?.mode === "note"
                ? "以 Markdown 文件保存到当前目录。"
                : "输入名称，方便查找与管理。"}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            {dialog?.mode === "move" ? (
              <label className="block text-sm">
                目标文件夹
                <select
                  className="mt-2 w-full rounded-lg border bg-background p-2"
                  onChange={(event) => setDestination(event.target.value)}
                  value={destination}
                >
                  <option value="">我的文档（根目录）</option>
                  {items
                    .filter((item) => item.kind === "folder")
                    .map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : (
              <label className="block text-sm">
                名称
                <input
                  autoFocus
                  className="mt-2 w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                  maxLength={180}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </label>
            )}
            {dialog?.mode === "note" && (
              <label className="block text-sm">
                内容
                <textarea
                  className="mt-2 min-h-48 w-full rounded-lg border bg-background p-3"
                  onChange={(event) => setContent(event.target.value)}
                  value={content}
                />
              </label>
            )}
            <DialogFooter>
              <Button
                disabled={busy}
                onClick={() => setDialog(null)}
                type="button"
                variant="outline"
              >
                取消
              </Button>
              <Button disabled={busy || !name.trim()} type="submit">
                {busy ? "保存中…" : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setPreview(null);
          }
        }}
        open={Boolean(preview)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
            <DialogDescription>图片预览</DialogDescription>
          </DialogHeader>
          {preview !== null && (
            <>
              <Image
                alt={preview.name}
                className="max-h-[70vh] w-full object-contain"
                height={700}
                src={`/api/library/${preview.id}?preview=1`}
                unoptimized
                width={1000}
              />
              <DialogFooter>
                <Button asChild>
                  <a download href={`/api/library/${preview.id}`}>
                    下载图片
                  </a>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
