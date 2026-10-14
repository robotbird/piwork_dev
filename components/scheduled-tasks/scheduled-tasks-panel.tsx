// biome-ignore-all lint/performance/noJsxPropsBind: small interactive task list uses row-scoped actions
"use client";

import {
  ArrowUp,
  Bot,
  ChevronRight,
  Clock3,
  Filter,
  Lightbulb,
  Loader2,
  Mic,
  MoreHorizontal,
  Newspaper,
  PauseCircle,
  Pencil,
  Play,
  Plus,
  Share,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { describeSchedule } from "@/lib/scheduler/display";
import { cn, copyTextToClipboard } from "@/lib/utils";

type Task = {
  id: string;
  taskType: string;
  prompt: string;
  enabled: boolean;
  schedule: { cron: string; timezone?: string };
  status: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  errorMessage: string | null;
  chatId: string | null;
};
type Run = {
  id: string;
  chatId: string | null;
  status: string;
  startedAt: string;
  errorMessage: string | null;
};
const labels: Record<string, string> = {
  cancelled: "scheduledTasks.paused",
  failed: "scheduledTasks.failed",
  pending: "scheduledTasks.pending",
  running: "scheduledTasks.running",
  succeeded: "scheduledTasks.completed",
};
const templates = [
  {
    description: "scheduledTasks.newsDescription",
    icon: Newspaper,
    query: "scheduledTasks.newsQuery",
    title: "scheduledTasks.newsTitle",
  },
  {
    description: "scheduledTasks.radarDescription",
    icon: Bot,
    query: "scheduledTasks.radarQuery",
    title: "scheduledTasks.radarTitle",
  },
  {
    description: "scheduledTasks.inspirationDescription",
    icon: Lightbulb,
    query: "scheduledTasks.inspirationQuery",
    title: "scheduledTasks.inspirationTitle",
  },
];

async function fetchJSON(
  url: string,
  fallback: string,
  timeoutMessage: string,
  options?: RequestInit
) {
  const signal = options?.signal ?? AbortSignal.timeout(30_000);
  try {
    const response = await fetch(url, { ...options, signal });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || fallback);
    }
    return body;
  } catch (error) {
    if (signal.aborted && signal.reason?.name === "TimeoutError") {
      throw new Error(timeoutMessage);
    }
    throw error;
  }
}
const date = (
  value: string | null,
  language: string,
  timezone = "Asia/Shanghai"
) =>
  value
    ? new Date(value).toLocaleString(language, {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "numeric",
        timeZone: timezone,
      })
    : "—";

const relativeTime = (
  value: string | null,
  t: (key: string, params?: import("@/lib/i18n").TranslationParams) => string
) => {
  if (!value) {
    return t("scheduledTasks.notScheduled");
  }
  const milliseconds = new Date(value).getTime() - Date.now();
  if (milliseconds <= 0) {
    return t("scheduledTasks.soon");
  }
  const hours = Math.max(1, Math.round(milliseconds / 3_600_000));
  if (hours < 24) {
    return t("scheduledTasks.hoursLater", { count: hours });
  }
  const days = Math.round(hours / 24);
  return t("scheduledTasks.daysLater", { count: days });
};

export function ScheduledTasksPanel() {
  const { t, language } = usePreferences();
  const request = (url: string, options?: RequestInit) =>
    fetchJSON(
      url,
      t("scheduledTasks.operationFailed"),
      t("scheduledTasks.requestTimedOut"),
      options
    );
  const {
    data: tasks,
    error,
    isLoading,
    mutate,
  } = useSWR<Task[]>("/api/scheduled-tasks", request, {
    refreshInterval: 5000,
  });
  const [query, setQuery] = useState("");
  const [multiline, setMultiline] = useState(false);
  const composerRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    const composer = composerRef.current;
    if (!textarea || !composer) {
      return;
    }
    const resize = () => {
      // 固定单行可用宽度，避免展开后的宽度变化导致布局反复切换。
      textarea.style.width = `${Math.max(composer.clientWidth - 144, 1)}px`;
      textarea.style.paddingInline = "0px";
      textarea.style.height = "0px";
      const needsMultiline = textarea.scrollHeight > 40;
      textarea.style.width = "";
      textarea.style.paddingInline = "";
      const height = textarea.scrollHeight;
      textarea.style.height = `${Math.min(height, 240)}px`;
      textarea.style.overflowY = height > 240 ? "auto" : "hidden";
      setMultiline(needsMultiline);
    };
    resize();
    let width = composer.clientWidth;
    const observer = new ResizeObserver(() => {
      if (composer.clientWidth !== width) {
        width = composer.clientWidth;
        resize();
      }
    });
    observer.observe(composer);
    return () => observer.disconnect();
  }, [query, multiline]);

  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<Task | null>(null);
  const [details, setDetails] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const startChat = (text: string) => {
    if (!text.trim()) {
      return;
    }
    window.location.assign(
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/?query=${encodeURIComponent(t("scheduledTasks.createPrompt", { text: text.trim() }))}`
    );
  };
  const change = async (task: Task, action: string) => {
    setBusy(task.id);
    try {
      await request(
        `/api/scheduled-tasks/${task.id}`,
        action === "delete"
          ? { method: "DELETE" }
          : {
              body: JSON.stringify({ action }),
              headers: { "Content-Type": "application/json" },
              method: "POST",
            }
      );
      toast.success(
        action === "run"
          ? t("scheduledTasks.started")
          : action === "pause"
            ? t("scheduledTasks.pauseNotice")
            : action === "resume"
              ? t("scheduledTasks.resumed")
              : t("scheduledTasks.deleted")
      );
      setDeleting(null);
      await mutate();
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : t("scheduledTasks.operationFailed")
      );
    } finally {
      setBusy(null);
    }
  };
  const shareTask = async (task: Task) => {
    const shareData = {
      text: `${task.prompt}\n${describeSchedule(task.schedule.cron, t)} · ${task.schedule.timezone || "Asia/Shanghai"}`,
      title: task.taskType,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        const succeeded = await copyTextToClipboard(
          `${shareData.title}\n${shareData.text}\n${shareData.url}`
        );
        if (!succeeded) {
          throw new Error("clipboard unavailable");
        }
        toast.success(t("scheduledTasks.copied"));
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        return;
      }
      toast.error(t("scheduledTasks.shareFailed"));
    }
  };
  const visible = tasks?.filter(
    (task) =>
      filter === "all" || (filter === "enabled" ? task.enabled : !task.enabled)
  );
  return (
    <>
      <div className="p-3 md:hidden">
        <SidebarTrigger />
      </div>
      <div className="mx-auto w-full max-w-3xl px-6 pb-16 pt-8 md:px-8 md:pt-16">
        <header className="mb-12 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-heading-lg">{t("scheduledTasks.title")}</h1>
            <p className="mt-1 text-body-lg text-muted-foreground">
              {t("scheduledTasks.description")}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="h-9 rounded-md bg-muted px-3 text-label-sm shadow-none transition-colors duration-150 hover:bg-accent"
                variant="secondary"
              >
                <Filter className="size-4" />
                {
                  {
                    all: t("scheduledTasks.all"),
                    enabled: t("scheduledTasks.enabled"),
                    paused: t("scheduledTasks.paused"),
                  }[filter]
                }
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {[
                ["all", t("scheduledTasks.all")],
                ["enabled", t("scheduledTasks.enabled")],
                ["paused", t("scheduledTasks.paused")],
              ].map(([value, label]) => (
                <DropdownMenuItem key={value} onClick={() => setFilter(value)}>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <form
          className={cn(
            "composer-plain grid min-h-14 grid-cols-[40px_minmax(0,1fr)_32px_32px] items-center gap-x-2 border border-[var(--hairline-strong)] bg-card px-2 py-[7px] shadow-[var(--shadow-whisper)]",
            multiline ? "gap-y-2 rounded-[28px]" : "rounded-full"
          )}
          ref={composerRef}
          onSubmit={(event) => {
            event.preventDefault();
            startChat(query);
          }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t("scheduledTasks.manual")}
                className="col-start-1 row-start-2 size-10 shrink-0 cursor-pointer rounded-full p-0 text-foreground transition-colors duration-150 hover:bg-muted focus-visible:bg-muted"
                onClick={() => setManual(true)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Plus className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("scheduledTasks.manual")}</TooltipContent>
          </Tooltip>
          <textarea
            aria-label={t("scheduledTasks.schedule")}
            className={cn(
              "min-w-0 w-full resize-none overflow-x-hidden whitespace-pre-wrap break-words bg-transparent py-2 text-base leading-6 outline-none placeholder:text-muted-foreground",
              multiline
                ? "col-span-4 col-start-1 row-start-1 px-3"
                : "col-start-2 row-start-2"
            )}
            maxLength={2000}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key !== "Enter" ||
                event.shiftKey ||
                event.nativeEvent.isComposing
              ) {
                return;
              }
              event.preventDefault();
              startChat(event.currentTarget.value);
            }}
            placeholder={t("scheduledTasks.schedule")}
            ref={textareaRef}
            rows={1}
            value={query}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t("scheduledTasks.voice")}
                className="col-start-3 row-start-2 size-8 shrink-0 rounded-full text-foreground transition-colors duration-150 hover:bg-muted"
                onClick={() => toast.info(t("scheduledTasks.voiceSoon"))}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Mic className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("scheduledTasks.voice")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t("scheduledTasks.scheduleWithAI")}
                className="col-start-4 row-start-2 size-8 shrink-0 rounded-full"
                disabled={!query.trim()}
                type="submit"
              >
                <ArrowUp className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t("scheduledTasks.scheduleWithAI")}
            </TooltipContent>
          </Tooltip>
        </form>
        <section aria-label={t("scheduledTasks.myTasks")} className="mt-10">
          {Boolean(isLoading) && (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("scheduledTasks.loading")}
            </p>
          )}
          {Boolean(error) && (
            <div className="rounded-xl border p-6 text-sm" role="alert">
              {t("scheduledTasks.loadFailed")}
              <Button onClick={() => mutate()} variant="link">
                {t("scheduledTasks.retry")}
              </Button>
            </div>
          )}
          {!isLoading && !error && visible?.length === 0 && (
            <div className="py-10 text-center">
              <Clock3 className="mx-auto mb-3 size-5 text-muted-foreground" />
              <p className="font-medium">
                {tasks?.length
                  ? t("scheduledTasks.noMatches")
                  : t("scheduledTasks.empty")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("scheduledTasks.emptyHint")}
              </p>
            </div>
          )}
          {visible?.map((task) => (
            <article
              className="group relative flex min-h-24 items-center gap-3 rounded-md px-4 py-4 transition-colors duration-150 hover:bg-muted"
              key={task.id}
            >
              <div className="flex size-10 shrink-0 items-center justify-center text-muted-foreground">
                <PauseCircle className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <button
                  className="max-w-full truncate text-left text-base font-medium leading-6 hover:underline"
                  onClick={() => setDetails(task)}
                  type="button"
                >
                  {task.taskType}
                </button>
                <p className="flex flex-wrap items-center gap-x-1.5 text-sm leading-5 text-muted-foreground">
                  {task.enabled
                    ? describeSchedule(task.schedule.cron, t)
                    : t("scheduledTasks.paused")}
                  {Boolean(task.enabled) && (
                    <span>
                      {t("scheduledTasks.nextRun", {
                        time: relativeTime(task.nextRunAt, t),
                      })}
                    </span>
                  )}
                </p>
                <p className="mt-1 line-clamp-1 pr-24 text-sm leading-5 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                  {task.prompt}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                  <span
                    className={
                      task.status === "failed"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    {labels[task.status] ? t(labels[task.status]) : task.status}
                    {task.lastRunAt
                      ? ` · ${date(task.lastRunAt, language, task.schedule.timezone)}`
                      : ""}
                  </span>
                  {Boolean(task.chatId) && (
                    <Link
                      className="inline-flex items-center text-link hover:text-link-deep hover:underline"
                      href={`/chat/${task.chatId}`}
                    >
                      {t("scheduledTasks.viewResult")}
                      <ChevronRight className="size-3" />
                    </Link>
                  )}
                </div>
                {Boolean(task.errorMessage) && (
                  <p className="mt-2 text-xs text-destructive">
                    {t(task.errorMessage ?? "")}
                  </p>
                )}
              </div>
              <Button
                aria-label={t("scheduledTasks.editName", {
                  name: task.taskType,
                })}
                className="absolute right-14 top-1/2 size-10 -translate-y-1/2 rounded-md text-muted-foreground opacity-0 transition-opacity duration-150 hover:bg-card hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100"
                disabled={task.status === "running"}
                onClick={() => setEditing(task)}
                size="icon"
                title={t("scheduledTasks.edit")}
                variant="ghost"
              >
                <Pencil className="size-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={t("scheduledTasks.manageName", {
                      name: task.taskType,
                    })}
                    className="absolute right-3 top-1/2 size-10 -translate-y-1/2 rounded-md text-foreground opacity-0 transition-colors duration-150 hover:bg-card group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:bg-card data-[state=open]:opacity-100"
                    disabled={busy === task.id}
                    size="icon"
                    title={t("scheduledTasks.more")}
                    variant="ghost"
                  >
                    <MoreHorizontal className="size-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 rounded-md border-border p-1.5 shadow-[var(--shadow-float)]"
                  sideOffset={4}
                >
                  <DropdownMenuItem
                    className="h-10 gap-3 rounded-sm px-3 text-sm"
                    disabled={task.status === "running"}
                    onClick={() => change(task, "run")}
                  >
                    <Play className="size-4" />
                    {t("scheduledTasks.runNow")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="h-10 gap-3 rounded-sm px-3 text-sm"
                    onClick={() => shareTask(task)}
                  >
                    <Share className="size-4" />
                    {t("scheduledTasks.share")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="h-10 gap-3 rounded-sm px-3 text-sm"
                    onClick={() =>
                      change(task, task.enabled ? "pause" : "resume")
                    }
                  >
                    <PauseCircle className="size-4" />
                    {task.enabled
                      ? t("scheduledTasks.pause")
                      : t("scheduledTasks.resume")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="h-10 gap-3 rounded-sm px-3 text-sm text-destructive focus:text-destructive"
                    disabled={task.status === "running"}
                    onClick={() => setDeleting(task)}
                  >
                    <Trash2 className="size-4" />
                    {t("scheduledTasks.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </article>
          ))}
        </section>
        <div className="mx-4 my-5 border-t border-dashed border-border" />
        <section
          aria-label={t("scheduledTasks.recommendedTasks")}
          className="pt-2"
        >
          <h2 className="mb-2 px-4 text-base font-medium text-muted-foreground">
            {t("scheduledTasks.recommended")}
          </h2>
          {templates.map((item) => (
            <button
              className="group flex min-h-20 w-full items-center gap-3 rounded-md px-4 py-3 text-left transition-colors duration-150 hover:bg-muted"
              key={t(item.title)}
              onClick={() => startChat(t(item.query))}
              type="button"
            >
              <span className="flex size-10 shrink-0 items-center justify-center text-muted-foreground">
                <item.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium leading-6">
                  {t(item.title)}
                </span>
                <span className="block text-sm leading-5 text-muted-foreground">
                  {t(item.description)}
                </span>
              </span>
              <Plus className="size-5 shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-foreground" />
            </button>
          ))}
        </section>
      </div>
      {Boolean(editing || manual) && (
        <TaskEditor
          key={editing?.id || "new"}
          onClose={() => {
            setEditing(null);
            setManual(false);
          }}
          onSaved={() => {
            setEditing(null);
            setManual(false);
            mutate().catch(console.error);
          }}
          task={editing}
        />
      )}
      {details !== null && (
        <TaskHistory onClose={() => setDetails(null)} task={details} />
      )}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
          }
        }}
        open={!!deleting}
      >
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>
              {t("scheduledTasks.deleteTitle", {
                name: deleting?.taskType ?? "",
              })}
            </DialogTitle>
            <DialogDescription>
              {t("scheduledTasks.deleteHint")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeleting(null)} variant="outline">
              {t("scheduledTasks.cancel")}
            </Button>
            <Button
              disabled={!!busy}
              onClick={() => deleting && change(deleting, "delete")}
              variant="destructive"
            >
              {busy === deleting?.id && (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              )}
              {t("scheduledTasks.deleteTask")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TaskEditor({
  task,
  onClose,
  onSaved,
}: {
  task: Task | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = usePreferences();
  const request = (url: string, options?: RequestInit) =>
    fetchJSON(
      url,
      t("scheduledTasks.operationFailed"),
      t("scheduledTasks.requestTimedOut"),
      options
    );
  const [title, setTitle] = useState(task?.taskType || "");
  const [prompt, setPrompt] = useState(task?.prompt || "");
  const [cron, setCron] = useState(task?.schedule.cron || "0 9 * * *");
  const [timezone, setTimezone] = useState(
    task?.schedule.timezone || "Asia/Shanghai"
  );
  const [saving, setSaving] = useState(false);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await request(
        task ? `/api/scheduled-tasks/${task.id}` : "/api/scheduled-tasks",
        {
          body: JSON.stringify({
            prompt,
            schedule: { cron, timezone },
            taskType: title,
          }),
          headers: { "Content-Type": "application/json" },
          method: task ? "PATCH" : "POST",
        }
      );
      toast.success(
        task ? t("scheduledTasks.updated") : t("scheduledTasks.created")
      );
      onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("scheduledTasks.saveFailed")
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open && !saving) {
          onClose();
        }
      }}
      open
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>
            {task ? t("scheduledTasks.edit") : t("scheduledTasks.manual")}
          </DialogTitle>
          <DialogDescription>
            {t("scheduledTasks.editorHint")}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <div className="space-y-2">
            <Label htmlFor="task-title">{t("scheduledTasks.name")}</Label>
            <Input
              id="task-title"
              maxLength={64}
              onChange={(event) => setTitle(event.target.value)}
              required
              value={title}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-prompt">
              {t("scheduledTasks.instructions")}
            </Label>
            <Textarea
              id="task-prompt"
              maxLength={10_000}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={t("scheduledTasks.instructionsHint")}
              required
              rows={5}
              value={prompt}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-preset">{t("scheduledTasks.plan")}</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              id="task-preset"
              onChange={(event) => {
                if (event.target.value !== "custom") {
                  setCron(event.target.value);
                }
              }}
              value={
                ["0 9 * * *", "0 9 * * 1-5", "0 9 * * 1", "0 * * * *"].includes(
                  cron
                )
                  ? cron
                  : "custom"
              }
            >
              <option value="0 9 * * *">
                {t("scheduledTasks.dailyPreset")}
              </option>
              <option value="0 9 * * 1-5">
                {t("scheduledTasks.weekdaysPreset")}
              </option>
              <option value="0 9 * * 1">
                {t("scheduledTasks.mondayPreset")}
              </option>
              <option value="0 * * * *">{t("scheduledTasks.hourly")}</option>
              <option value="custom">{t("scheduledTasks.custom")}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="task-cron">{t("scheduledTasks.cron")}</Label>
              <Input
                id="task-cron"
                onChange={(event) => setCron(event.target.value)}
                required
                value={cron}
              />
              <p className="text-xs text-muted-foreground">
                {t("scheduledTasks.cronHint")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-zone">{t("scheduledTasks.timezone")}</Label>
              <Input
                id="task-zone"
                onChange={(event) => setTimezone(event.target.value)}
                required
                value={timezone}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={saving}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              {t("scheduledTasks.cancel")}
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? t("scheduledTasks.saving") : t("scheduledTasks.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskHistory({ task, onClose }: { task: Task; onClose: () => void }) {
  const { t, language } = usePreferences();
  const request = (url: string, options?: RequestInit) =>
    fetchJSON(
      url,
      t("scheduledTasks.operationFailed"),
      t("scheduledTasks.requestTimedOut"),
      options
    );
  const { data, error, isLoading } = useSWR<{ runs: Run[] }>(
    `/api/scheduled-tasks/${task.id}`,
    request,
    { refreshInterval: 5000 }
  );
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>{task.taskType}</DialogTitle>
          <DialogDescription>
            {t("scheduledTasks.historyTitle", {
              timezone: task.schedule.timezone || "Asia/Shanghai",
            })}
          </DialogDescription>
        </DialogHeader>
        {Boolean(isLoading) && (
          <p className="text-sm text-muted-foreground">
            {t("scheduledTasks.loadingHistory")}
          </p>
        )}
        {Boolean(error) && (
          <p className="text-sm text-destructive" role="alert">
            {t("scheduledTasks.historyFailed")}
          </p>
        )}
        {data?.runs.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("scheduledTasks.noHistory")}
          </p>
        )}
        {data?.runs.map((run) => (
          <div className="border-b py-3 last:border-0" key={run.id}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <Clock3 size={15} />
                {date(run.startedAt, language, task.schedule.timezone)}
              </span>
              <span>
                {labels[run.status] ? t(labels[run.status]) : run.status}
              </span>
            </div>
            {Boolean(run.errorMessage) && (
              <p className="mt-2 text-xs text-destructive">
                {t(run.errorMessage ?? "")}
              </p>
            )}
            {Boolean(run.chatId) && (
              <Link
                className="mt-2 inline-block text-sm text-primary hover:underline"
                href={`/chat/${run.chatId}`}
              >
                {t("scheduledTasks.openResult")}
              </Link>
            )}
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}
