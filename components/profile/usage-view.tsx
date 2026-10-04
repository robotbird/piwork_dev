"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePreferences } from "@/components/preferences-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { getProfile } from "@/lib/db/profile-queries";
import { cn } from "@/lib/utils";

type Mode = "daily" | "weekly" | "cumulative";
const shades = [
  "bg-muted",
  "bg-blue-900 dark:bg-blue-950",
  "bg-blue-700",
  "bg-blue-500",
  "bg-blue-300",
];

export function UsageView({
  profile,
}: {
  profile: NonNullable<Awaited<ReturnType<typeof getProfile>>>;
}) {
  const { t, language } = usePreferences();
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    const observer = new ResizeObserver(() => {
      chart.scrollLeft = chart.scrollWidth;
    });
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);
  const [mode, setMode] = useState<Mode>("daily");
  const days = profile.activity;
  const offset = days.length
    ? new Date(`${days[0].date}T00:00:00Z`).getUTCDay()
    : 0;
  const cells = [...Array.from({ length: offset }, () => null), ...days];
  const weeks = Array.from(
    { length: Math.ceil(cells.length / 7) },
    (_, index) => cells.slice(index * 7, index * 7 + 7)
  );
  const tokenFormat = new Intl.NumberFormat(
    language === "zh" ? "zh-CN" : "en",
    { maximumFractionDigits: 2, notation: "compact" }
  );
  const peak = Math.max(0, ...days.map((day) => day.tokens ?? 0));
  let longest = 0;
  let streak = 0;
  for (const day of days) {
    streak = day.count > 0 ? streak + 1 : 0;
    longest = Math.max(longest, streak);
  }
  let current = 0;
  const end = days.length - (days.at(-1)?.count ? 1 : 2);
  for (let i = end; i >= 0 && days[i].count > 0; i -= 1) {
    current += 1;
  }
  let cumulative = 0;
  const values = weeks.map((week) => {
    const weekly = week.reduce((sum, day) => sum + (day?.tokens ?? 0), 0);
    return week.map((day) => {
      cumulative += day?.tokens ?? 0;
      return day
        ? mode === "weekly"
          ? weekly
          : mode === "cumulative"
            ? cumulative
            : (day.tokens ?? 0)
        : 0;
    });
  });
  const maximum = Math.max(1, ...values.flat());
  const metrics = [
    {
      label: "usage.totalTokens",
      value: tokenFormat.format(profile.stats.totalTokens),
    },
    { label: "usage.peak", value: tokenFormat.format(peak) },
    {
      label: "profile.longest",
      value: `${Math.floor(Math.max(0, profile.stats.longestSeconds) / 60)} ${t("profile.minutes")}`,
    },
    { label: "usage.currentStreak", value: `${current} ${t("usage.days")}` },
    { label: "usage.longestStreak", value: `${longest} ${t("usage.days")}` },
  ];
  const changeMode = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) =>
      setMode(event.currentTarget.dataset.mode as Mode),
    []
  );
  let previousMonth = "";
  const labels = weeks.map((week) => {
    const day =
      week.find((item) => item?.date.endsWith("-01")) ?? week.find(Boolean);
    const month = day?.date.slice(0, 7) ?? "";
    const show = month !== previousMonth;
    previousMonth = month;
    return show && day
      ? language === "zh"
        ? `${Number(day.date.slice(5, 7))}月`
        : new Intl.DateTimeFormat("en", {
            month: "short",
            timeZone: "UTC",
          }).format(new Date(`${day.date}T00:00:00Z`))
      : "";
  });
  return (
    <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-12 lg:py-16">
      <div className="mx-auto w-full max-w-[960px]">
        <h1 className="text-2xl font-semibold">{t("profile.usage")}</h1>
        <div className="mt-10 grid grid-cols-2 rounded-2xl border p-4 sm:grid-cols-3 xl:grid-cols-5">
          {metrics.map((metric) => (
            <div className="p-4 text-center" key={metric.label}>
              <p className="text-xl font-semibold">{metric.value}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(metric.label)}
              </p>
            </div>
          ))}
        </div>
        <section aria-label={t("usage.activity")} className="mt-12">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">{t("usage.activity")}</h2>
            <div className="flex gap-1">
              {(["daily", "weekly", "cumulative"] as const).map((item) => (
                <button
                  aria-pressed={mode === item}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    mode === item
                      ? "bg-accent font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                  data-mode={item}
                  key={item}
                  onClick={changeMode}
                  type="button"
                >
                  {t(`usage.${item}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto pb-3" ref={chartRef}>
            <div className="min-w-[760px]">
              <div
                className="grid gap-1.5"
                style={{
                  gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
                }}
              >
                {weeks.map((week, weekIndex) => (
                  <div
                    className="grid grid-rows-7 gap-1.5"
                    key={week.find(Boolean)?.date ?? weekIndex}
                  >
                    {Array.from({ length: 7 }, (_, row) => {
                      const day = week[row];
                      const value = values[weekIndex][row] ?? 0;
                      const level = value
                        ? Math.min(
                            4,
                            Math.max(1, Math.ceil((value / maximum) * 4))
                          )
                        : 0;
                      if (!day) {
                        return (
                          <span
                            aria-hidden="true"
                            className="aspect-square"
                            // biome-ignore lint/suspicious/noArrayIndexKey: Fixed seven weekday slots never reorder.
                            key={`empty-${row}`}
                          />
                        );
                      }
                      const date = {
                        day: Number(day.date.slice(8, 10)),
                        month: Number(day.date.slice(5, 7)),
                      };
                      const label =
                        day.tokens === null
                          ? t("usage.unrecorded", date)
                          : t("usage.dayTooltip", {
                              ...date,
                              tokens: tokenFormat.format(day.tokens),
                            });
                      return (
                        <Tooltip key={day.date}>
                          <TooltipTrigger asChild>
                            <button
                              aria-label={`${day.date}: ${label}`}
                              className={cn(
                                "aspect-square rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                                shades[level]
                              )}
                              data-date={day.date}
                              type="button"
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" sideOffset={6}>
                            {label}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div
                className="mt-3 grid text-xs text-muted-foreground"
                style={{
                  gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
                }}
              >
                {labels.map((label, index) => (
                  <span
                    className="whitespace-nowrap"
                    key={weeks[index].find(Boolean)?.date ?? index}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <span>{t("usage.less")}</span>
            {shades.map((shade) => (
              <span className={cn("size-3 rounded-sm", shade)} key={shade} />
            ))}
            <span>{t("usage.more")}</span>
          </div>
          <p className="mt-6 text-xs leading-6 text-muted-foreground">
            {t("usage.hint")}
          </p>
        </section>
      </div>
    </main>
  );
}
