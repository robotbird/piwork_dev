import "server-only";
import { createHash } from "node:crypto";
import { createScheduledTaskTool } from "@/lib/ai/scheduled-task-tools";
import { createScheduledTask } from "@/lib/db/scheduled-task-queries";

export function scheduledTaskTools(userId: string, messageId: string) {
  return [
    createScheduledTaskTool(async (input) => {
      const hash = createHash("sha256")
        .update(JSON.stringify([userId, messageId, input]))
        .digest("hex");
      const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
      const task = await createScheduledTask(userId, input, id);
      if (!task) {
        throw new Error("创建任务失败");
      }
      return {
        id: task.id,
        nextRunAt: task.nextRunAt,
        schedule: task.schedule,
        title: task.taskType,
        url: "/scheduled-tasks",
      };
    }),
  ];
}
