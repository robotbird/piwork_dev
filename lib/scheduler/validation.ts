import { z } from "zod";
import { DEFAULT_TIMEZONE, getNextRunTime } from "./cron-utils";

export const taskInputSchema = z
  .object({
    prompt: z.string().trim().min(1).max(10_000),
    schedule: z
      .object({
        cron: z.string().trim().min(1).max(100),
        timezone: z.string().trim().min(1).max(64).default(DEFAULT_TIMEZONE),
      })
      .strict()
      .superRefine((schedule, ctx) => {
        try {
          getNextRunTime(schedule.cron, new Date(), schedule.timezone);
        } catch {
          ctx.addIssue({
            code: "custom",
            message: "无效的计划或时区",
            path: ["cron"],
          });
        }
      }),
    taskType: z.string().trim().min(1).max(64),
  })
  .strict();
export type TaskInput = z.infer<typeof taskInputSchema>;
