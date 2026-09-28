// biome-ignore-all lint/performance/noJsxPropsBind: Client component for scheduled tasks
"use client";

import { CalendarClock, Clock, Copy, CornerDownLeft, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ScheduledTask {
  id: string;
  taskType: string;
  prompt: string;
  schedule: { cron: string; timezone?: string };
  status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastResult: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const statusStyles = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 animate-pulse",
  succeeded: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const statusLabels = {
  pending: "待执行",
  running: "运行中",
  succeeded: "成功",
  failed: "失败",
  cancelled: "已取消",
};

const defaultCronOptions = [
  { label: "每天早上 9:00", value: "0 9 * * *" },
  { label: "每周一上午 9:00", value: "0 9 * * 1" },
  { label: "每周日早上 12:00", value: "0 0 * * 0" },
  { label: "每小时整点", value: "0 * * * *" },
  { label: "每 30 分钟", value: "*/30 * * * *" },
  { label: "每天午夜", value: "0 0 * * *" },
];

export function ScheduledTasksPanel() {
  const { data: tasks, mutate } = useSWR<ScheduledTask[]>(
    "/api/scheduled-tasks",
    fetcher
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">定时任务</h1>
          <p className="text-muted-foreground mt-1">
            管理 AI 自动化任务和定期报告
          </p>
        </div>
        <Button onClick={() => { setEditingTask(null); setIsDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          新建任务
        </Button>
      </div>

      {/* Loading state */}
      {!tasks && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Empty state */}
      {tasks && tasks.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <CalendarClock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">还没有定时任务</h3>
            <p className="text-muted-foreground mb-4">
              点击"新建任务"创建第一个 AI 自动化任务
            </p>
            <Button onClick={() => { setEditingTask(null); setIsDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              新建任务
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Task list */}
      {tasks && tasks.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={() => {
                setEditingTask(task);
                setIsDialogOpen(true);
              }}
              onDelete={async () => {
                if (!confirm("确定要删除此任务吗？")) return;
                try {
                  await fetch(`/api/scheduled-tasks/${task.id}`, {
                    method: "DELETE",
                  });
                  toast.success("任务已删除");
                  mutate();
                } catch {
                  toast.error("删除失败");
                }
              }}
              onRefresh={() => mutate()}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <CreateTaskDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingTask(null);
        }}
        task={editingTask}
        onSuccess={() => {
          mutate();
          setIsDialogOpen(false);
          setEditingTask(null);
        }}
      />
    </div>
  );
}

function TaskCard({
  task,
  onEdit,
  onDelete,
  onRefresh,
}: {
  task: ScheduledTask;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("zh-CN");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{task.taskType}</CardTitle>
            <CardDescription className="mt-1 line-clamp-2">
              {task.prompt.substring(0, 80)}
              {task.prompt.length > 80 && "..."}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>编辑</DropdownMenuItem>
              <DropdownMenuItem onClick={onRefresh}>刷新</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600"
                onClick={onDelete}
              >
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">下次运行:</span>
            <span>{formatTime(task.nextRunAt)}</span>
          </div>
          {task.lastRunAt && (
            <div className="flex items-center gap-2">
              <CornerDownLeft className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">上次运行:</span>
              <span>{formatTime(task.lastRunAt)}</span>
            </div>
          )}
          <div className="flex items-center gap-2 pt-2">
            <span
              className={cn(
                "px-2 py-1 rounded-md text-xs font-medium",
                statusStyles[task.status]
              )}
            >
              {statusLabels[task.status]}
            </span>
            {task.errorMessage && (
              <span className="text-red-500 text-xs" title={task.errorMessage}>
                ⚠️ {task.errorMessage.substring(0, 30)}...
              </span>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <code className="block w-full overflow-x-auto rounded bg-muted px-3 py-2 text-xs">
          {task.schedule.cron}
        </code>
      </CardFooter>
    </Card>
  );
}

function CreateTaskDialog({
  isOpen,
  onClose,
  task,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  task: ScheduledTask | null;
  onSuccess: () => void;
}) {
  const [taskType, setTaskType] = useState(task?.taskType || "");
  const [prompt, setPrompt] = useState(task?.prompt || "");
  const [cron, setCron] = useState(task?.schedule?.cron || "0 9 * * *");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!taskType || !prompt) {
      toast.error("请填写所有必填项");
      return;
    }

    setIsLoading(true);
    try {
      const url = "/api/scheduled-tasks";
      const method = task ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(task ? { id: task.id } : {}),
          taskType,
          prompt,
          schedule: { cron },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "操作失败");
      }

      toast.success(task ? "任务已更新" : "任务已创建");
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{task ? "编辑任务" : "创建定时任务"}</DialogTitle>
          <DialogDescription>
            设置 AI 任务的调度计划和执行提示词
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="taskType">任务名称 *</Label>
            <Input
              id="taskType"
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              placeholder="例如：每日工作报告"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule">调度计划</Label>
            <Select value={cron} onValueChange={setCron}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {defaultCronOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Cron: {cron}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt">AI 提示词 *</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="输入 AI 将要执行的任务描述..."
              rows={6}
            />
            <p className="text-sm text-muted-foreground">
              AI 将在每个调度时间点执行此提示词
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "保存中..." : task ? "更新" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Icons that were imported but might not be available
function MoreHorizontalIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>;
}