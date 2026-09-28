export function describeSchedule(cron: string): string {
  const [minute, hour, day, month, week] = cron.split(/\s+/);
  const time = `${hour?.padStart(2, "0")}:${minute?.padStart(2, "0")}`;
  if (
    /^\d+$/.test(minute) &&
    /^\d+$/.test(hour) &&
    day === "*" &&
    month === "*"
  ) {
    if (week === "*") {
      return `每天 ${time}`;
    }
    if (week === "1-5") {
      return `工作日 ${time}`;
    }
    if (/^[0-7]$/.test(week)) {
      return `每周${"日一二三四五六日"[Number(week)]} ${time}`;
    }
  }
  if (cron === "0 * * * *") {
    return "每小时整点";
  }
  return cron;
}
