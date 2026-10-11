import { CronExpressionParser } from "cron-parser";
import { LocalizedError, translateMessage } from "@/lib/i18n/messages";

export const DEFAULT_TIMEZONE = "Asia/Shanghai";

export function getNextRunTime(
  cron: string,
  from = new Date(),
  timezone = DEFAULT_TIMEZONE
): Date {
  if (cron.trim().split(/\s+/).length !== 5 || /[^0-9*,/\s-]/.test(cron)) {
    throw new LocalizedError("runtimeMessages.cronFields");
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
      error:
        error instanceof Error
          ? error.message
          : translateMessage("runtimeMessages.invalidPlan"),
      isValid: false,
    };
  }
}

export { describeSchedule } from "./display";
