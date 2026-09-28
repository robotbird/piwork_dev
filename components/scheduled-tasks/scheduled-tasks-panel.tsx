// biome-ignore-all lint/performance/noJsxPropsBind: small interactive task list uses row-scoped actions
"use client";

import {
  ArrowUp,
  CalendarClock,
  ChevronRight,
  Clock3,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
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
    icon: "📰",
    query:
      "请创建定时任务：每天上午 9 点（北京时间）整理 AI、Agent 与大模型领域的重要动态，注明来源；无法联网时请如实说明。",
    title: "AI 前沿日报",
  },
  {
    description: "每周五，关注 AI 编程、MCP 与 Skill 生态的新进展",
    icon: "🤖",
    query:
      "请创建定时任务：每周五上午 9 点（北京时间）整理 AI 编程、MCP 与 Skill 生态的重要进展，附上可靠来源。",
    title: "AI 编程研究雷达",
  },
  {
    description: "每天一个可实践的工作方法，让想法变成行动",
    icon: "💡",
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
  const visible = tasks?.filter(
    (task) =>
      filter === "all" || (filter === "enabled" ? task.enabled : !task.enabled)
  );
  return (
    <>
      <div className="p-3 md:hidden">
        <SidebarTrigger />
      </div>
      <div className="mx-auto max-w-5xl px-6 pb-16 pt-8 md:px-12 md:pt-14">
        <header className="mb-9 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">任务中心</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-base">
              创建和管理定时任务，让 AI 按计划执行工作，持续跟踪更新
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="rounded-full" variant="secondary">
                <Filter size={16} />
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
          className="flex items-center gap-3 rounded-3xl border bg-background px-3 py-3 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            startChat(query);
          }}
        >
          <Button
            aria-label="手动创建任务"
            className="shrink-0 rounded-full"
            onClick={() => setManual(true)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Plus size={22} />
          </Button>
          <input
            aria-label="安排任务"
            className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground"
            maxLength={2000}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="安排任务，例如：每天早上 9 点整理 AI 日报"
            value={query}
          />
          <Button
            aria-label="通过 AI 安排任务"
            className="shrink-0 rounded-full"
            disabled={!query.trim()}
            size="icon"
            type="submit"
          >
            <ArrowUp size={22} />
          </Button>
        </form>
        <p className="mt-3 px-3 text-xs text-muted-foreground">
          通过对话安排周期任务 · 默认北京时间 · 运行结果保存在任务对话中
        </p>
        <section aria-label="我的任务" className="mt-9">
          {Boolean(isLoading) && (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="animate-spin" size={18} />
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
              <CalendarClock
                className="mx-auto mb-3 text-muted-foreground"
                size={30}
              />
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
              className="flex gap-4 border-b py-6 last:border-0"
              key={task.id}
            >
              <div className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                <CalendarClock size={23} />
              </div>
              <div className="min-w-0 flex-1">
                <button
                  className="text-left text-lg font-medium hover:underline"
                  onClick={() => setDetails(task)}
                  type="button"
                >
                  {task.taskType}
                </button>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <span
                    className={`size-2 rounded-full ${task.enabled ? "bg-blue-500" : "bg-muted-foreground"}`}
                  />
                  {task.enabled
                    ? describeSchedule(task.schedule.cron)
                    : "已暂停"}
                  <span>· {task.schedule.timezone || "Asia/Shanghai"}</span>
                  {Boolean(task.enabled) && (
                    <span>
                      · 下次运行：{date(task.nextRunAt, task.schedule.timezone)}
                    </span>
                  )}
                </p>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {task.prompt}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
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
                      className="inline-flex items-center text-primary hover:underline"
                      href={`/chat/${task.chatId}`}
                    >
                      查看结果
                      <ChevronRight size={13} />
                    </Link>
                  )}
                </div>
                {Boolean(task.errorMessage) && (
                  <p className="mt-2 text-xs text-destructive">
                    {task.errorMessage}
                  </p>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={`管理 ${task.taskType}`}
                    disabled={busy === task.id}
                    size="icon"
                    variant="ghost"
                  >
                    <MoreHorizontal size={19} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={task.status === "running"}
                    onClick={() => change(task, "run")}
                  >
                    立即运行
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      change(task, task.enabled ? "pause" : "resume")
                    }
                  >
                    {task.enabled ? "暂停任务" : "恢复任务"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={task.status === "running"}
                    onClick={() => setEditing(task)}
                  >
                    编辑任务
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDetails(task)}>
                    运行记录
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    disabled={task.status === "running"}
                    onClick={() => setDeleting(task)}
                  >
                    删除任务
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </article>
          ))}
        </section>
        <section aria-label="推荐任务" className="mt-7 border-t pt-7">
          <h2 className="mb-2 text-sm text-muted-foreground">从一个想法开始</h2>
          {templates.map((item) => (
            <button
              className="flex w-full items-center gap-4 border-b py-6 text-left transition-colors hover:bg-muted/40 last:border-0"
              key={item.title}
              onClick={() => startChat(item.query)}
              type="button"
            >
              <span className="flex size-11 shrink-0 items-center justify-center text-3xl">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium md:text-lg">
                  {item.title}
                </span>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                  {item.description}
                </span>
              </span>
              <Plus className="shrink-0 text-muted-foreground" size={21} />
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
