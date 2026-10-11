import type { TranslationParams } from "@/lib/i18n";

export function describeSchedule(
  cron: string,
  t: (key: string, params?: TranslationParams) => string
): string {
  const [minute, hour, day, month, week] = cron.split(/\s+/);
  const time = `${hour?.padStart(2, "0")}:${minute?.padStart(2, "0")}`;
  if (
    /^\d+$/.test(minute) &&
    /^\d+$/.test(hour) &&
    day === "*" &&
    month === "*"
  ) {
    if (week === "*") {
      return t("scheduledTasks.daily", { time });
    }
    if (week === "1-5") {
      return t("scheduledTasks.weekdays", { time });
    }
    if (/^[0-7]$/.test(week)) {
      return t("scheduledTasks.weekly", {
        day: t(
          `scheduledTasks.${["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][Number(week)]}`
        ),
        time,
      });
    }
  }
  if (cron === "0 * * * *") {
    return t("scheduledTasks.hourly");
  }
  return cron;
}
