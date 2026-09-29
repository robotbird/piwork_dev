// biome-ignore-all lint/performance/noJsxPropsBind: small interactive project lists use row-scoped actions
"use client";

import {
  ArrowUpIcon,
  FolderIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateUUID } from "@/lib/utils";
import {
  formatShortDate,
  type ProjectChatSummary,
  type ProjectSourceSummary,
  request,
} from "./shared";

type Tab = "chats" | "sources";

const ACCEPTED_SOURCE_EXTENSIONS = ".pdf,.txt,.md";

export function ProjectHome({
  projectId,
  projectName: initialProjectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const t = useTranslations("projects");
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();

  const [projectName, setProjectName] = useState(initialProjectName);
  const [tab, setTab] = useState<Tab>("chats");
  const [input, setInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<ProjectChatSummary | null>(
    null
  );
  const [sourceToDelete, setSourceToDelete] =
    useState<ProjectSourceSummary | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const { data: chatsData, mutate: mutateChats } = useSWR<{
    chats: ProjectChatSummary[];
  }>(`/api/projects/${projectId}/chats`, request);
  const { data: sourcesData, mutate: mutateSources } = useSWR<{
    sources: ProjectSourceSummary[];
  }>(tab === "sources" ? `/api/projects/${projectId}/sources` : null, request);

  const chats = chatsData?.chats ?? [];
  const sources = sourcesData?.sources ?? [];

  /** 大输入框提交：预建聊天后带 ?query= 跳转，由聊天页自动发出首条消息 */
  const startChat = async (query?: string) => {
    if (creating) {
      return;
    }
    setCreating(true);
    try {
      const { chat } = await request<{
        chat: { id: string };
      }>(`/api/projects/${projectId}/chats`, {
        body: JSON.stringify({ id: generateUUID() }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const search = query ? `?query=${encodeURIComponent(query)}` : "";
      router.push(`/projects/${projectId}/chat/${chat.id}${search}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("createFailed"));
      setCreating(false);
    }
  };

  const handleUploadFiles = async (fileList: FileList) => {
    const files = Array.from(fileList);
    if (files.length === 0) {
      return;
    }
    setUploading(true);
    let succeeded = 0;
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      try {
        // biome-ignore lint/performance/noAwaitInLoops: 逐个上传，避免并发触发解析压力
        await request(`/api/projects/${projectId}/sources`, {
          body: form,
          method: "POST",
        });
        succeeded += 1;
      } catch (error) {
        toast.error(
          `${file.name}: ${error instanceof Error ? error.message : t("uploadFailed")}`
        );
      }
    }
    if (succeeded > 0) {
      toast.success(t("sourcesUploaded", { count: succeeded }));
      await mutateSources();
    }
    setUploading(false);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  };

  const handleRename = async () => {
    const name = renameValue.trim();
    if (!name || renaming) {
      return;
    }
    setRenaming(true);
    try {
      await request(`/api/projects/${projectId}`, {
        body: JSON.stringify({ name }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      setProjectName(name);
      setRenameOpen(false);
      globalMutate("/api/projects");
      toast.success(t("renamed", { name }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("renameFailed"));
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteProject = async () => {
    if (deleting) {
      return;
    }
    setDeleting(true);
    try {
      await request(`/api/projects/${projectId}`, { method: "DELETE" });
      toast.success(t("deleted", { name: projectName }));
      globalMutate("/api/projects");
      router.push("/projects");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("deleteFailed"));
      setDeleting(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!chatToDelete) {
      return;
    }
    try {
      await request(`/api/chat?id=${chatToDelete.chatId}`, {
        method: "DELETE",
      });
      mutateChats(
        (current) =>
          current && {
            chats: current.chats.filter(
              (chat) => chat.chatId !== chatToDelete.chatId
            ),
          },
        { revalidate: false }
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("deleteFailed"));
    }
    setChatToDelete(null);
  };

  const handleDeleteSource = async () => {
    if (!sourceToDelete) {
      return;
    }
    try {
      await request(`/api/projects/${projectId}/sources/${sourceToDelete.id}`, {
        method: "DELETE",
      });
      mutateSources(
        (current) =>
          current && {
            sources: current.sources.filter(
              (source) => source.id !== sourceToDelete.id
            ),
          },
        { revalidate: false }
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("deleteFailed"));
    }
    setSourceToDelete(null);
  };

  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col overflow-y-auto px-6 pb-16 pt-12 md:px-8">
      <header className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <FolderIcon className="size-5 shrink-0 text-muted-foreground" />
          <h1 className="truncate text-heading-lg text-foreground">
            {projectName}
          </h1>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={t("moreActions")}
              size="icon-sm"
              variant="ghost"
            >
              <MoreHorizontalIcon className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={() => {
                setRenameValue(projectName);
                setRenameOpen(true);
              }}
            >
              <PencilIcon className="size-4" />
              {t("renameAction")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon className="size-4" />
              {t("deleteProjectAction")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <form
        className="composer-plain mt-8 flex h-14 items-center gap-2 rounded-3xl border border-[var(--hairline-strong)] bg-card pr-2 pl-3"
        onSubmit={(event) => {
          event.preventDefault();
          const value = input.trim();
          if (value) {
            setInput("");
            startChat(value);
          }
        }}
      >
        <PlusIcon
          aria-hidden="true"
          className="size-5 shrink-0 text-muted-foreground"
        />
        <input
          aria-label={t("startChatAction")}
          className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground"
          disabled={creating}
          maxLength={2000}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            // 显式处理 Enter：值直接读自输入框，避免依赖发送按钮的可用态；
            // IME 组合中的 Enter（如确认中文候选）不触发发送
            if (event.key !== "Enter" || event.nativeEvent.isComposing) {
              return;
            }
            event.preventDefault();
            const value = event.currentTarget.value.trim();
            if (value) {
              setInput("");
              startChat(value);
            }
          }}
          placeholder={t("inputPlaceholder", { name: projectName })}
          type="text"
          value={input}
        />
        <Button
          aria-label={t("startChatAction")}
          className="size-8 shrink-0 rounded-full"
          disabled={!input.trim() || creating}
          type="submit"
        >
          <ArrowUpIcon className="size-4" />
        </Button>
      </form>

      <nav className="mt-8 flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-md bg-muted p-1">
          {(
            [
              ["chats", t("chatsTab")],
              ["sources", t("sourcesTab")],
            ] as const
          ).map(([value, label]) => (
            <button
              className={`rounded-sm px-4 py-1.5 text-sm transition-colors ${
                tab === value
                  ? "bg-card font-medium text-foreground shadow-[var(--shadow-whisper)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              key={value}
              onClick={() => setTab(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "sources" ? (
          <Button
            className="gap-1.5 text-muted-foreground"
            disabled={uploading}
            onClick={() => uploadInputRef.current?.click()}
            size="sm"
            variant="ghost"
          >
            <UploadIcon className="size-4" />
            {uploading ? t("uploadingLabel") : t("uploadAction")}
          </Button>
        ) : null}
      </nav>
      <input
        accept={ACCEPTED_SOURCE_EXTENSIONS}
        className="hidden"
        multiple
        onChange={(event) => {
          if (event.target.files?.length) {
            handleUploadFiles(event.target.files);
          }
        }}
        ref={uploadInputRef}
        type="file"
      />

      {tab === "chats" ? (
        <section className="mt-6">
          {chats.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("emptyChatsHint")}
            </p>
          ) : (
            <ul className="flex flex-col">
              {chats.map((chat) => (
                <ChatRow
                  chat={chat}
                  key={chat.chatId}
                  onDelete={() => setChatToDelete(chat)}
                  onOpen={() =>
                    router.push(`/projects/${projectId}/chat/${chat.chatId}`)
                  }
                />
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="mt-6">
          {sources.length === 0 ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--hairline-strong)] px-6 text-center">
              <p className="text-base font-semibold text-foreground">
                {t("emptySourcesTitle")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("emptySourcesHint")}
              </p>
              <Button
                className="mt-4 rounded-full"
                disabled={uploading}
                onClick={() => uploadInputRef.current?.click()}
                size="sm"
              >
                {uploading ? t("uploadingLabel") : t("sourcesAction")}
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col">
              {sources.map((source) => (
                <li key={source.id}>
                  <div className="group flex items-center gap-4 rounded-md border border-transparent px-3 py-3 transition-colors hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium text-foreground">
                        {source.name}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {sourceTypeLabel(source.type)}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {formatShortDate(source.createdAt)}
                    </span>
                    <Button
                      aria-label={t("deleteAction")}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => setSourceToDelete(source)}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <Trash2Icon className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 重命名 */}
      <Dialog onOpenChange={setRenameOpen} open={renameOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t("renameTitle")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleRename();
            }}
          >
            <div className="grid gap-2 py-2">
              <Label htmlFor="rename-project">{t("nameLabel")}</Label>
              <Input
                autoFocus
                id="rename-project"
                maxLength={128}
                onChange={(event) => setRenameValue(event.target.value)}
                value={renameValue}
              />
            </div>
            <DialogFooter className="mt-2">
              <Button
                onClick={() => setRenameOpen(false)}
                type="button"
                variant="ghost"
              >
                {t("cancelAction")}
              </Button>
              <Button disabled={!renameValue.trim() || renaming} type="submit">
                {t("saveAction")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除项目 */}
      <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmDescription", { name: projectName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancelAction")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                handleDeleteProject();
              }}
            >
              {t("deleteProjectAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除聊天 */}
      <AlertDialog
        onOpenChange={(open) => !open && setChatToDelete(null)}
        open={chatToDelete !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteChatConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteChatConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancelAction")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDeleteChat();
              }}
            >
              {t("deleteAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除来源 */}
      <AlertDialog
        onOpenChange={(open) => !open && setSourceToDelete(null)}
        open={sourceToDelete !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteSourceConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteSourceConfirmDescription", {
                name: sourceToDelete?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancelAction")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDeleteSource();
              }}
            >
              {t("deleteAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChatRow({
  chat,
  onDelete,
  onOpen,
}: {
  chat: ProjectChatSummary;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const t = useTranslations("projects");
  return (
    <li>
      <div className="group flex items-center gap-4 border-b border-[var(--hairline-soft)] px-3 py-4 transition-colors hover:bg-muted/50">
        <button
          className="min-w-0 flex-1 text-left"
          onClick={onOpen}
          type="button"
        >
          <span className="block truncate text-base font-medium text-foreground">
            {chat.title}
          </span>
          <span className="mt-0.5 block truncate text-sm text-muted-foreground">
            {chat.summary ?? "—"}
          </span>
        </button>
        <span className="shrink-0 text-sm text-muted-foreground">
          {formatShortDate(chat.updatedAt)}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={t("moreActions")}
              className="opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
              size="icon-sm"
              variant="ghost"
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={onOpen}>
              {t("openChatAction")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              {t("deleteAction")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function sourceTypeLabel(type: ProjectSourceSummary["type"]): string {
  if (type === "pdf") {
    return "PDF";
  }
  if (type === "markdown") {
    return "Markdown";
  }
  return "TXT";
}
