import { CronExpressionParser } from "cron-parser";

export const DEFAULT_TIMEZONE = "Asia/Shanghai";

export function getNextRunTime(
  cron: string,
  from = new Date(),
  timezone = DEFAULT_TIMEZONE
): Date {
  if (cron.trim().split(/\s+/).length !== 5 || /[^0-9*,/\s-]/.test(cron)) {
    throw new Error("请使用五段 Cron（分钟、小时、日、月、星期）");
  }
  new Intl.DateTimeFormat("en", { timeZone: timezone }).format(from);
  return CronExpressionParser.parse(cron, { currentDate: from, tz: timezone })
    .next()
    .toDate();
}

export function parseCron(cron: string) {
  try {
    getNextRunTime(cron);
    return { isValid: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "无效计划",
      isValid: false,
    };
  }
}

export { describeSchedule } from "./display";
