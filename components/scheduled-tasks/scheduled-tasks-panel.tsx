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
import { useState } from "react";
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
  cancelled: "已暂停",
  failed: "失败",
  pending: "尚未运行",
  running: "运行中",
  succeeded: "已完成",
};
const templates = [
  {
    description: "每天整理 AI、Agent 与大模型领域的重要动态",
    icon: Newspaper,
    query:
      "请创建定时任务：每天上午 9 点（北京时间）整理 AI、Agent 与大模型领域的重要动态，注明来源；无法联网时请如实说明。",
    title: "AI 前沿日报",
  },
  {
    description: "每周五，关注 AI 编程、MCP 与 Skill 生态的新进展",
    icon: Bot,
    query:
      "请创建定时任务：每周五上午 9 点（北京时间）整理 AI 编程、MCP 与 Skill 生态的重要进展，附上可靠来源。",
    title: "AI 编程研究雷达",
  },
  {
    description: "每天一个可实践的工作方法，让想法变成行动",
    icon: Lightbulb,
    query:
      "请创建定时任务：每天上午 8 点（北京时间）分享一个提升工作效率的方法，附具体例子与当天可以实践的小行动。",
    title: "每日灵感",
  },
];

async function request(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "操作失败");
  }
  return body;
}
const date = (value: string | null, timezone = "Asia/Shanghai") =>
  value
    ? new Date(value).toLocaleString("zh-CN", {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "numeric",
        timeZone: timezone,
      })
    : "—";

const relativeTime = (value: string | null) => {
  if (!value) {
    return "尚未安排";
  }
  const milliseconds = new Date(value).getTime() - Date.now();
  if (milliseconds <= 0) {
    return "即将运行";
  }
  const hours = Math.max(1, Math.round(milliseconds / 3_600_000));
  if (hours < 24) {
    return `${hours}小时后`;
  }
  const days = Math.round(hours / 24);
  return `${days}天后`;
};

export function ScheduledTasksPanel() {
  const {
    data: tasks,
    error,
    isLoading,
    mutate,
  } = useSWR<Task[]>("/api/scheduled-tasks", request, {
    refreshInterval: 5000,
  });
  const [query, setQuery] = useState("");
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
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/?query=${encodeURIComponent(`请帮我安排周期定时任务：${text.trim()}`)}`
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
          ? "任务已开始运行"
          : action === "pause"
            ? "已暂停后续计划，当前运行会继续完成"
            : action === "resume"
              ? "任务已恢复"
              : "任务已删除"
      );
      setDeleting(null);
      await mutate();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "操作失败");
    } finally {
      setBusy(null);
    }
  };
  const shareTask = async (task: Task) => {
    const shareData = {
      text: `${task.prompt}\n${describeSchedule(task.schedule.cron)} · ${task.schedule.timezone || "Asia/Shanghai"}`,
      title: task.taskType,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(
          `${shareData.title}\n${shareData.text}\n${shareData.url}`
        );
        toast.success("任务信息已复制");
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        return;
      }
      toast.error("分享失败，请稍后重试");
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
      <div className="mx-auto max-w-[920px] px-4 pb-16 pt-8 md:px-8 md:pt-16">
        <header className="mb-12 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-heading-lg">定时任务</h1>
            <p className="mt-1 text-body-lg text-muted-foreground">
              询问 PiWork，让其安排任务、设置提醒或监控更新
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
                  { all: "全部任务", enabled: "已开启", paused: "已暂停" }[
                    filter
                  ]
                }
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {[
                ["all", "全部任务"],
                ["enabled", "已开启"],
                ["paused", "已暂停"],
              ].map(([value, label]) => (
                <DropdownMenuItem key={value} onClick={() => setFilter(value)}>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <form
          className="composer-plain flex min-h-16 items-center gap-2 rounded-xl border border-[var(--hairline-strong)] bg-card px-3 shadow-[var(--shadow-float)]"
          onSubmit={(event) => {
            event.preventDefault();
            startChat(query);
          }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="手动创建任务"
                className="size-10 shrink-0 rounded-full text-foreground transition-colors duration-150 hover:bg-muted"
                onClick={() => setManual(true)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Plus className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>手动创建任务</TooltipContent>
          </Tooltip>
          <input
            aria-label="安排任务"
            className="min-w-0 flex-1 bg-transparent py-3 text-body-lg outline-none placeholder:text-muted-foreground"
            maxLength={2000}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="安排任务"
            value={query}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="语音输入"
                className="size-10 shrink-0 rounded-full text-foreground transition-colors duration-150 hover:bg-muted"
                onClick={() => toast.info("语音输入功能正在准备中")}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Mic className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>语音输入</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="通过 AI 安排任务"
                className="size-10 shrink-0 rounded-full bg-primary text-primary-foreground transition-colors duration-150 hover:bg-primary/85 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                disabled={!query.trim()}
                size="icon"
                type="submit"
              >
                <ArrowUp className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>通过 AI 安排任务</TooltipContent>
          </Tooltip>
        </form>
        <section aria-label="我的任务" className="mt-10">
          {Boolean(isLoading) && (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在加载任务…
            </p>
          )}
          {Boolean(error) && (
            <div className="rounded-xl border p-6 text-sm" role="alert">
              任务加载失败。
              <Button onClick={() => mutate()} variant="link">
                重试
              </Button>
            </div>
          )}
          {!isLoading && !error && visible?.length === 0 && (
            <div className="py-10 text-center">
              <Clock3 className="mx-auto mb-3 size-5 text-muted-foreground" />
              <p className="font-medium">
                {tasks?.length
                  ? "没有符合筛选条件的任务"
                  : "把重复的工作交给 AI"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                在上方描述要做的事和执行时间，即可开始安排。
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
                    ? describeSchedule(task.schedule.cron)
                    : "已暂停"}
                  {Boolean(task.enabled) && (
                    <span>· 下次运行：{relativeTime(task.nextRunAt)}</span>
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
                    {labels[task.status] || task.status}
                    {task.lastRunAt
                      ? ` · ${date(task.lastRunAt, task.schedule.timezone)}`
                      : ""}
                  </span>
                  {Boolean(task.chatId) && (
                    <Link
                      className="inline-flex items-center text-link hover:text-link-deep hover:underline"
                      href={`/chat/${task.chatId}`}
                    >
                      查看结果
                      <ChevronRight className="size-3" />
                    </Link>
                  )}
                </div>
                {Boolean(task.errorMessage) && (
                  <p className="mt-2 text-xs text-destructive">
                    {task.errorMessage}
                  </p>
                )}
              </div>
              <Button
                aria-label={`编辑 ${task.taskType}`}
                className="absolute right-14 top-1/2 size-10 -translate-y-1/2 rounded-md text-muted-foreground opacity-0 transition-opacity duration-150 hover:bg-card hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100"
                disabled={task.status === "running"}
                onClick={() => setEditing(task)}
                size="icon"
                title="编辑任务"
                variant="ghost"
              >
                <Pencil className="size-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={`管理 ${task.taskType}`}
                    className="absolute right-3 top-1/2 size-10 -translate-y-1/2 rounded-md text-foreground opacity-0 transition-colors duration-150 hover:bg-card group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:bg-card data-[state=open]:opacity-100"
                    disabled={busy === task.id}
                    size="icon"
                    title="更多操作"
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
                    立即运行
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="h-10 gap-3 rounded-sm px-3 text-sm"
                    onClick={() => shareTask(task)}
                  >
                    <Share className="size-4" />
                    分享
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="h-10 gap-3 rounded-sm px-3 text-sm"
                    onClick={() =>
                      change(task, task.enabled ? "pause" : "resume")
                    }
                  >
                    <PauseCircle className="size-4" />
                    {task.enabled ? "暂停" : "恢复"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="h-10 gap-3 rounded-sm px-3 text-sm text-destructive focus:text-destructive"
                    disabled={task.status === "running"}
                    onClick={() => setDeleting(task)}
                  >
                    <Trash2 className="size-4" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </article>
          ))}
        </section>
        <div className="mx-4 my-5 border-t border-dashed border-border" />
        <section aria-label="推荐任务" className="pt-2">
          <h2 className="mb-2 px-4 text-base font-medium text-muted-foreground">
            推荐
          </h2>
          {templates.map((item) => (
            <button
              className="group flex min-h-20 w-full items-center gap-3 rounded-md px-4 py-3 text-left transition-colors duration-150 hover:bg-muted"
              key={item.title}
              onClick={() => startChat(item.query)}
              type="button"
            >
              <span className="flex size-10 shrink-0 items-center justify-center text-muted-foreground">
                <item.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium leading-6">
                  {item.title}
                </span>
                <span className="block text-sm leading-5 text-muted-foreground">
                  {item.description}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除“{deleting?.taskType}”？</DialogTitle>
            <DialogDescription>
              删除计划与运行记录，已经生成的聊天结果会保留。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeleting(null)} variant="outline">
              取消
            </Button>
            <Button
              disabled={!!busy}
              onClick={() => deleting && change(deleting, "delete")}
              variant="destructive"
            >
              删除任务
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
      toast.success(task ? "任务已更新" : "任务已创建");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "编辑任务" : "手动创建任务"}</DialogTitle>
          <DialogDescription>
            设定周期与工作内容，每次运行都会生成独立的结果对话。
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <div className="space-y-2">
            <Label htmlFor="task-title">任务名称</Label>
            <Input
              id="task-title"
              maxLength={64}
              onChange={(event) => setTitle(event.target.value)}
              required
              value={title}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-prompt">执行内容</Label>
            <Textarea
              id="task-prompt"
              maxLength={10_000}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="具体描述 AI 每次需要完成的工作"
              required
              rows={5}
              value={prompt}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-preset">执行计划</Label>
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
              <option value="0 9 * * *">每天 09:00</option>
              <option value="0 9 * * 1-5">工作日 09:00</option>
              <option value="0 9 * * 1">每周一 09:00</option>
              <option value="0 * * * *">每小时整点</option>
              <option value="custom">自定义计划</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="task-cron">Cron 表达式</Label>
              <Input
                id="task-cron"
                onChange={(event) => setCron(event.target.value)}
                required
                value={cron}
              />
              <p className="text-xs text-muted-foreground">
                分钟 小时 日 月 星期
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-zone">时区</Label>
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
              取消
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? "保存中…" : "保存任务"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskHistory({ task, onClose }: { task: Task; onClose: () => void }) {
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
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task.taskType}</DialogTitle>
          <DialogDescription>
            最近 20 次运行 · {task.schedule.timezone || "Asia/Shanghai"}
          </DialogDescription>
        </DialogHeader>
        {Boolean(isLoading) && (
          <p className="text-sm text-muted-foreground">正在加载…</p>
        )}
        {Boolean(error) && (
          <p className="text-sm text-destructive" role="alert">
            记录加载失败，请稍后重试。
          </p>
        )}
        {data?.runs.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            尚无运行记录，可从任务菜单立即运行。
          </p>
        )}
        {data?.runs.map((run) => (
          <div className="border-b py-3 last:border-0" key={run.id}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <Clock3 size={15} />
                {date(run.startedAt, task.schedule.timezone)}
              </span>
              <span>{labels[run.status]}</span>
            </div>
            {Boolean(run.errorMessage) && (
              <p className="mt-2 text-xs text-destructive">
                {run.errorMessage}
              </p>
            )}
            {Boolean(run.chatId) && (
              <Link
                className="mt-2 inline-block text-sm text-primary hover:underline"
                href={`/chat/${run.chatId}`}
              >
                打开结果对话 →
              </Link>
            )}
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}
