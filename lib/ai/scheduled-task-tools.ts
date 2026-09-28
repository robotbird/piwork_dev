import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import { type TaskInput, taskInputSchema } from "@/lib/scheduler/validation";

export const schedulingPrompt =
  "用户明确要求定时或周期执行工作时，使用 create_scheduled_task 创建任务，而不是仅口头承诺。默认时区 Asia/Shanghai；缺少执行时间时先询问。MVP 仅支持周期计划（每日、工作日、每周或 Cron），不支持一次性提醒、事件监测或邮件/推送通知；不要把一次性请求转为周期任务。执行提示词必须自包含，不假定能读取此前对话或文件。工具成功后告知名称、时间、时区，并链接 /scheduled-tasks。当前时间：";

// Identity and database access are injected by the authenticated host, never model arguments.
export function createScheduledTaskTool(
  create: (input: TaskInput) => Promise<unknown>
): AgentTool {
  return {
    description:
      "Create a recurring AI task when explicitly requested. Only report success after this tool succeeds. Does not send external notifications.",
    execute: async (_id, input) => {
      const task = await create(taskInputSchema.parse(input));
      return {
        content: [{ text: JSON.stringify(task), type: "text" }],
        details: {},
      };
    },
    label: "创建定时任务",
    name: "create_scheduled_task",
    parameters: Type.Object({
      prompt: Type.String({
        description: "Self-contained instructions to execute each time",
        maxLength: 10_000,
        minLength: 1,
      }),
      schedule: Type.Object({
        cron: Type.String({ description: "Five-field cron, e.g. 0 9 * * 1-5" }),
        timezone: Type.String({
          description: "IANA timezone, default Asia/Shanghai",
        }),
      }),
      taskType: Type.String({
        description: "Short user-facing task title",
        maxLength: 64,
        minLength: 1,
      }),
    }),
  };
}
