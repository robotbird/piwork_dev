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
    mode: "folder" | "rename" | "note";
    item?: LibraryItem;
  } | null>(null);
  const [name, setName] = useState("");
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
  function openDialog(mode: "folder" | "rename" | "note", item?: LibraryItem) {
    setName(item?.name ?? "");
    setContent("");
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
            body: JSON.stringify({ name: name.trim(), parentId }),
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
      className="relative min-h-dvh w-full bg-background px-5 py-7 md:px-10 xl:px-12"
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
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden" />
            <h1 className="text-[30px] font-semibold tracking-tight">
              我的文档
            </h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            上传的各类文件，以及 AI 生成的文档和图片，统一存储与管理。
          </p>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <div className="hidden items-center gap-1 sm:flex">
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
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border px-4 sm:w-56">
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
              <Button className="rounded-full px-5" disabled={busy}>
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {busy ? "上传中" : "新建"}
                <ChevronDown className="ml-2 size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-2xl p-2">
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
      <nav
        aria-label="文档分类"
        className="mt-8 flex gap-2 overflow-x-auto pb-2"
      >
        {tabs.map((label) => (
          <button
            aria-pressed={tab === label}
            className={cn(
              "shrink-0 rounded-full px-5 py-2 text-sm transition-colors",
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
            <section className="mt-8">
              <h2 className="mb-4 text-lg font-semibold">
                文件夹{" "}
                <span className="ml-1 font-normal text-muted-foreground">
                  ({folders.length})
                </span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {folders.map((folder, index) => (
                  <div
                    className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                    key={folder.id}
                  >
                    <button
                      className="flex min-w-0 flex-1 items-center gap-4 text-left"
                      onClick={() => navigate(folder.id)}
                      type="button"
                    >
                      <Folder
                        className={cn(
                          "size-12 shrink-0 stroke-[1.2]",
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
            <section className="mt-9">
              <h2 className="mb-4 text-lg font-semibold">
                {search ? "搜索结果" : "最近文件"}{" "}
                <span className="ml-1 font-normal text-muted-foreground">
                  ({files.length})
                </span>
              </h2>
              <div
                className={
                  view === "grid"
                    ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                    : "overflow-hidden rounded-2xl border"
                }
              >
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
                        "group bg-card",
                        view === "grid"
                          ? "rounded-2xl border border-border/70 p-3.5 shadow-sm transition-shadow hover:shadow-md"
                          : "flex items-center gap-4 border-b p-4 last:border-0"
                      )}
                      key={item.id}
                    >
                      {view === "grid" && (
                        <button
                          aria-label={
                            image ? `预览 ${item.name}` : `下载 ${item.name}`
                          }
                          className={cn(
                            "relative mb-3 flex aspect-[1.55] w-full items-center justify-center overflow-hidden rounded-lg",
                            color
                          )}
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
                            <div className="flex h-[85%] w-[77%] flex-col items-start justify-between rounded-t-md border border-border/30 bg-background p-5 text-left shadow-sm">
                              <Icon className="size-8" />
                              <span className="line-clamp-2 text-sm font-medium text-foreground">
                                {item.name.replace(/\.[^.]+$/, "")}
                              </span>
                              <span className="text-[10px] font-semibold tracking-widest opacity-60">
                                {label}
                              </span>
                            </div>
                          )}
                          {item.source === "ai" && (
                            <span className="absolute right-2 top-2 rounded-full bg-background/95 px-2 py-1 text-[11px] font-medium text-indigo-500">
                              AI 生成
                            </span>
                          )}
                        </button>
                      )}
                      <div
                        className={cn(
                          "flex min-w-0 items-start gap-2",
                          view === "list" && "flex-1 items-center"
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-7 shrink-0 place-items-center rounded-md",
                            color
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <a
                            className="block truncate text-[13px] font-medium hover:underline"
                            download
                            href={`/api/library/${item.id}`}
                            title={item.name}
                          >
                            {item.name}
                          </a>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {item.size ? formatFileSize(item.size) : "—"} ·{" "}
                            {dateLabel(item.updatedAt)}
                          </p>
                        </div>
                        {view === "list" && item.source === "ai" && (
                          <span className="hidden text-xs text-indigo-500 sm:block">
                            AI 生成
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
      <p className="mt-10 flex items-center gap-2 text-xs text-muted-foreground">
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
              {dialog?.mode === "rename"
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
