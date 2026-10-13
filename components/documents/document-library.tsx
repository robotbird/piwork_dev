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
import { usePreferences } from "@/components/preferences-provider";
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
import { useUploadSettings } from "@/hooks/use-upload-settings";
import {
  fileCategory,
  formatFileSize,
  type LibraryItem,
} from "@/lib/documents/types";
import { uploadLimitBytes } from "@/lib/uploads/settings";
import { cn } from "@/lib/utils";
import styles from "./document-library.module.css";

const tabs = [
  "all",
  "folders",
  "documents",
  "images",
  "spreadsheets",
  "presentations",
  "aiGenerated",
] as const;
const dateLabel = (value: string, language: string) =>
  new Date(value).toLocaleString(language, {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
async function fetchJSON(url: string, fallback: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? fallback);
  }
  return response.json();
}
function fileStyle(item: LibraryItem) {
  const category = fileCategory(item.name, item.contentType);
  if (category === "images") {
    return {
      color: "text-violet-500 bg-violet-50 dark:bg-violet-950/30",
      Icon: ImageIcon,
      label: "documents.coverImage",
    };
  }
  if (category === "spreadsheets") {
    return {
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
      Icon: Sheet,
      label: "documents.coverSheet",
    };
  }
  if (category === "presentations") {
    return {
      color: "text-orange-500 bg-orange-50 dark:bg-orange-950/30",
      Icon: Presentation,
      label: "documents.coverSlides",
    };
  }
  return {
    color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30",
    Icon: FileText,
    label: item.name.split(".").pop()?.toUpperCase() ?? "documents.coverFile",
  };
}

export function DocumentLibrary() {
  const { t, language } = usePreferences();
  const { data: uploadSettings } = useUploadSettings();
  const requestJSON = (url: string, options?: RequestInit) =>
    fetchJSON(url, t("documents.operationFailed"), options);
  const {
    data: items = [],
    error,
    isLoading,
    mutate,
  } = useSWR<LibraryItem[]>("/api/library", requestJSON, {
    refreshInterval: 15_000,
  });
  const [tab, setTab] = useState<string>("all");
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
    (item) => item.kind === "folder" && ["all", "folders"].includes(tab)
  );
  const files = scoped.filter(
    (item) =>
      item.kind === "file" &&
      (tab === "all" ||
        (tab === "aiGenerated"
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
    setTab("all");
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
    if (uploadSettings && file.size > uploadLimitBytes(uploadSettings)) {
      throw new Error(
        t("documents.fileLimit", {
          maxMB: uploadSettings.maxFileSizeMB,
          name: file.name,
        })
      );
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
        toast.error(
          err instanceof Error ? err.message : t("documents.uploadFailed")
        );
      }
    }
    if (success) {
      toast.success(t("documents.archived", { count: success }));
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
      toast.success(t("documents.saved"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("documents.saveFailed")
      );
    } finally {
      setBusy(false);
    }
  }
  function actions(item: LibraryItem) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("documents.itemActions", { name: item.name })}
            className="size-8 shrink-0 text-muted-foreground"
            size="icon"
            variant="ghost"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openDialog("rename", item)}>
            {t("documents.rename")}
          </DropdownMenuItem>
          {item.kind === "file" && (
            <DropdownMenuItem onClick={() => openDialog("move", item)}>
              {t("documents.move")}
            </DropdownMenuItem>
          )}
          {item.kind === "file" && (
            <DropdownMenuItem asChild>
              <a download href={`/api/library/${item.id}`}>
                <Download className="mr-2 size-4" />
                {t("documents.download")}
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
            <h1 className={styles.heading}>{t("documents.title")}</h1>
          </div>
          <p className={styles.subtitle}>{t("documents.description")}</p>
        </div>
        <div className={styles.toolbar}>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              aria-label={t("documents.gridView")}
              aria-pressed={view === "grid"}
              className={cn("rounded-full", view === "grid" && "bg-muted")}
              onClick={() => setView("grid")}
              size="icon"
              variant="ghost"
            >
              <Grid2X2 className="size-5" />
            </Button>
            <Button
              aria-label={t("documents.listView")}
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
              aria-label={t("documents.search")}
              className="w-full bg-transparent text-sm outline-none"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("documents.searchPlaceholder")}
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
                {busy ? t("documents.uploading") : t("documents.new")}
                <ChevronDown className="ml-2 size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-2xl border-border bg-card p-2.5 shadow-lg [&_[role=menuitem]]:gap-2 [&_[role=menuitem]]:rounded-lg [&_[role=menuitem]]:px-3 [&_[role=menuitem]]:py-2.5"
            >
              <DropdownMenuItem onClick={() => openDialog("note")}>
                <FileText className="mr-2 size-4" />
                {t("documents.note")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openDialog("folder")}>
                <Folder className="mr-2 size-4" />
                {t("documents.folders")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => input.current?.click()}>
                <Upload className="mr-2 size-4" />
                {t("documents.upload")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            aria-label={t("documents.selectUpload")}
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
      <nav aria-label={t("documents.categories")} className={styles.tabs}>
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
            {t(`documents.${label}`)}
          </button>
        ))}
      </nav>
      {parentId && !search && (
        <nav
          aria-label={t("documents.folderPath")}
          className="mt-5 flex flex-wrap items-center gap-2 text-sm"
        >
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={() => navigate(null)}
            type="button"
          >
            {t("documents.title")}
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
          <p>{t("documents.loadFailed")}</p>
          <Button className="mt-4" onClick={() => mutate()} variant="outline">
            {t("documents.reload")}
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
                {t("documents.folders")}{" "}
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
                          {t("documents.folderCounts", {
                            files: items.filter(
                              (item) =>
                                item.parentId === folder.id &&
                                item.kind === "file"
                            ).length,
                            folders: items.filter(
                              (item) =>
                                item.parentId === folder.id &&
                                item.kind === "folder"
                            ).length,
                          })}
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
                {search ? t("documents.results") : t("documents.recent")}{" "}
                <span className="ml-1 font-normal text-muted-foreground">
                  ({files.length})
                </span>
              </h2>
              <div
                className={view === "grid" ? styles.fileGrid : styles.fileList}
              >
                {view === "list" && (
                  <div aria-hidden="true" className={styles.listHeader}>
                    <span>{t("documents.filename")}</span>
                    <span>{t("documents.size")}</span>
                    <span>{t("documents.updated")}</span>
                    <span>{t("documents.source")}</span>
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
                            image
                              ? t("documents.previewFile", { name: item.name })
                              : t("documents.downloadFile", { name: item.name })
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
                              <span className={styles.coverLabel}>
                                {t(label)}
                              </span>
                            </div>
                          )}
                          {item.source === "ai" && (
                            <span className={styles.aiBadge}>
                              {t("documents.aiGenerated")}
                            </span>
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
                            <span>{dateLabel(item.updatedAt, language)}</span>
                          </p>
                        </div>
                        {view === "list" && (
                          <span
                            className={cn(
                              styles.listSource,
                              item.source === "ai" && styles.listSourceAi
                            )}
                          >
                            {item.source === "ai"
                              ? t("documents.aiGenerated")
                              : t("documents.myFiles")}
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
                {search ? t("documents.noMatches") : t("documents.empty")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {search ? t("documents.trySearch") : t("documents.emptyHint")}
              </p>
              {!search && (
                <Button
                  className="mt-6 rounded-full"
                  disabled={busy}
                  onClick={() => input.current?.click()}
                >
                  <Plus className="mr-2 size-4" />
                  {t("documents.upload")}
                </Button>
              )}
            </div>
          )}
        </>
      )}
      <p className={styles.hint}>
        <Sparkles className="size-3.5" />
        {uploadSettings
          ? t("documents.limits", { maxMB: uploadSettings.maxFileSizeMB })
          : t("documents.limitsUnavailable")}
      </p>
      {dragging === true && (
        <div className="pointer-events-none absolute inset-3 z-40 grid place-items-center rounded-2xl border-2 border-dashed border-blue-400 bg-background/95">
          <div className="text-center">
            <Upload className="mx-auto mb-4 size-10 text-blue-500" />
            <p className="text-xl font-medium">{t("documents.dropHint")}</p>
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
                ? t("documents.move")
                : dialog?.mode === "rename"
                  ? t("documents.rename")
                  : dialog?.mode === "note"
                    ? t("documents.newNote")
                    : t("documents.newFolder")}
            </DialogTitle>
            <DialogDescription>
              {dialog?.mode === "note"
                ? t("documents.noteHint")
                : t("documents.nameHint")}
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
                {t("documents.destination")}
                <select
                  className="mt-2 w-full rounded-lg border bg-background p-2"
                  onChange={(event) => setDestination(event.target.value)}
                  value={destination}
                >
                  <option value="">{t("documents.root")}</option>
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
                {t("documents.name")}
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
                {t("documents.content")}
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
                {t("documents.cancel")}
              </Button>
              <Button disabled={busy || !name.trim()} type="submit">
                {busy ? t("documents.saving") : t("documents.save")}
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
            <DialogDescription>{t("documents.imagePreview")}</DialogDescription>
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
                    {t("documents.downloadImage")}
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
