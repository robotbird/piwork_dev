"use client";

import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  type Locale,
} from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import {
  ActivityIcon,
  ArrowRightIcon,
  BoxIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleIcon,
  DatabaseIcon,
  FileBarChartIcon,
  FileTextIcon,
  PackageCheckIcon,
  PresentationIcon,
  RefreshCwIcon,
  SearchCheckIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EChartsChart } from "@/components/admin/echarts-chart";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { AdminOverview } from "@/lib/admin/overview";
import { getChartTheme } from "@/lib/chart-theme";
import { cn } from "@/lib/utils";

type OverviewRunStatus =
  | "aborted"
  | "failed"
  | "queued"
  | "running"
  | "settled"
  | "starting"
  | "waiting_user";

type OverviewServiceStatus =
  | "degraded"
  | "disabled"
  | "error"
  | "operational"
  | "unknown";

const panelClass = "rounded-xl border border-border bg-card";

const SKILL_ICONS = [
  ActivityIcon,
  PresentationIcon,
  FileTextIcon,
  SearchCheckIcon,
  UsersIcon,
] as const;

const RUN_STATUS_META: Record<
  OverviewRunStatus,
  { className: string; labelKey: string }
> = {
  aborted: { className: "text-muted-foreground", labelKey: "runAborted" },
  failed: { className: "text-destructive", labelKey: "runFailed" },
  queued: { className: "text-warning", labelKey: "runActive" },
  running: { className: "text-warning", labelKey: "runActive" },
  settled: { className: "text-link", labelKey: "runSettled" },
  starting: { className: "text-warning", labelKey: "runActive" },
  waiting_user: { className: "text-warning", labelKey: "runActive" },
};

const SERVICE_LABEL_KEYS: Record<string, string> = {
  database: "serviceDatabase",
  model_providers: "serviceModelProviders",
  sandbox: "serviceSandbox",
  scheduler: "serviceScheduler",
};

const SERVICE_STATUS_META: Record<
  OverviewServiceStatus,
  { className: string; labelKey: string }
> = {
  degraded: { className: "text-warning", labelKey: "statusDegraded" },
  disabled: {
    className: "text-muted-foreground",
    labelKey: "statusDisabled",
  },
  error: { className: "text-destructive", labelKey: "statusError" },
  operational: { className: "text-link", labelKey: "statusOperational" },
  unknown: { className: "text-muted-foreground", labelKey: "statusUnknown" },
};

const ACTIVITY_META: Record<string, { className: string; labelKey: string }> = {
  member: { className: "bg-primary", labelKey: "activityMember" },
  sandbox: { className: "bg-link", labelKey: "activitySandbox" },
  scheduled_task: { className: "bg-warning", labelKey: "activityTask" },
  skill: { className: "bg-primary", labelKey: "activitySkill" },
  tool: { className: "bg-link", labelKey: "activityTool" },
};

function PanelHeader({
  action,
  title,
}: {
  action?: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex h-12 items-center justify-between border-b border-border px-5">
      <h2 className="text-[16px] font-medium text-foreground">{title}</h2>
      {action}
    </div>
  );
}

function ViewAll({ href = "/admin" }: { href?: string }) {
  const { t } = usePreferences();

  return (
    <Link
      className="flex items-center gap-1 text-xs font-medium text-link hover:text-link-deep"
      href={href}
    >
      {t("dashboard.viewAll")} <ArrowRightIcon className="size-3.5" />
    </Link>
  );
}

function RangeButton() {
  const { t } = usePreferences();

  return (
    <button
      className="flex h-8 items-center gap-2 rounded-md border border-[var(--hairline-strong)] bg-card px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      type="button"
    >
      {t("dashboard.last30Days")} <ChevronDownIcon className="size-3.5" />
    </button>
  );
}

/** 数值环比（任务量/活跃用户）；delta 为 null 时无法定义（基线为 0） */
function DeltaBadge({
  delta,
  unit = "%",
}: {
  delta: number | null;
  unit?: string;
}) {
  const { t } = usePreferences();

  return (
    <div className="pb-0.5 text-right text-[12px]">
      {delta === null ? (
        <p className="font-semibold text-muted-foreground">—</p>
      ) : delta >= 0 ? (
        <p className="font-semibold text-link">
          ↑ {delta}
          {unit}
        </p>
      ) : (
        <p className="font-semibold text-destructive">
          ↓ {-delta}
          {unit}
        </p>
      )}
      <p className="mt-0.5 text-muted-foreground">
        {t("dashboard.vsLastMonth")}
      </p>
    </div>
  );
}

/** 指标卡：Skill / 工具为时点值，右侧展示启用数而非环比 */
function EnabledBadge({ count }: { count: number }) {
  const { t } = usePreferences();

  return (
    <div className="pb-0.5 text-right text-[12px]">
      <p className="font-semibold text-foreground">
        {t("dashboard.enabledCount", { count })}
      </p>
    </div>
  );
}

function MetricCard({
  change,
  icon: Icon,
  iconClass,
  label,
  value,
}: {
  change: React.ReactNode;
  icon: typeof BoxIcon;
  iconClass: string;
  label: string;
  value: string;
}) {
  return (
    <article className="min-h-[126px] border-b border-border p-5 last:border-b-0 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0 xl:[&:nth-child(odd)]:border-r">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid size-11 place-items-center rounded-xl",
            iconClass
          )}
        >
          <Icon className="size-6" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <strong className="text-[27px] font-medium leading-none tracking-[-0.025em] text-foreground tabular-nums">
          {value}
        </strong>
        {change}
      </div>
    </article>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  const { t } = usePreferences();

  return (
    <tr>
      <td
        className="h-16 px-4 text-center text-muted-foreground"
        colSpan={colSpan}
      >
        {t("dashboard.noData")}
      </td>
    </tr>
  );
}

function formatDuration(ms: number | null): string {
  if (ms === null) {
    return "—";
  }
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatStamp(
  iso: string,
  labels: { today: string; yesterday: string },
  locale: Locale,
  english: boolean
): string {
  const date = new Date(iso);
  const time = format(date, "HH:mm");
  if (isToday(date)) {
    return `${labels.today} ${time}`;
  }
  if (isYesterday(date)) {
    return `${labels.yesterday} ${time}`;
  }
  return format(date, english ? "MMM d, HH:mm" : "M月d日 HH:mm", { locale });
}

function shortDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function DashboardOverview({
  initialOverview,
}: {
  initialOverview: AdminOverview | null;
}) {
  const { language, t } = usePreferences();
  const english = language !== "zh";
  const [overview, setOverview] = useState(initialOverview);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setFetching(true);
    try {
      const response = await fetch("/api/admin/overview", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("overview refresh failed");
      }
      setOverview((await response.json()) as AdminOverview);
      setFetchError(false);
    } catch {
      setFetchError(true);
    } finally {
      inFlight.current = false;
      setFetching(false);
    }
  }, []);

  const missingInitial = initialOverview === null;
  useEffect(() => {
    if (missingInitial) {
      refresh();
    }
  }, [missingInitial, refresh]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { resolvedTheme } = useTheme();
  const chart = useMemo(
    () => getChartTheme(mounted && resolvedTheme === "dark" ? "dark" : "light"),
    [mounted, resolvedTheme]
  );

  const locale = english ? enUS : zhCN;
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(english ? "en-US" : "zh-CN"),
    [english]
  );

  const trend = overview?.trend ?? [];
  const trendOption = useMemo(
    () => ({
      animationDuration: 550,
      color: [chart.palette[0], chart.neutralSeries],
      grid: { bottom: 24, containLabel: true, left: 12, right: 10, top: 20 },
      series: [
        {
          barMaxWidth: 11,
          data: trend.map((point) => point.succeeded),
          emphasis: { disabled: true },
          name: t("dashboard.success"),
          stack: "tasks",
          type: "bar",
        },
        {
          barMaxWidth: 11,
          data: trend.map((point) => point.failed),
          emphasis: { disabled: true },
          name: t("dashboard.failed"),
          stack: "tasks",
          type: "bar",
        },
      ],
      tooltip: {
        backgroundColor: chart.tooltipBackground,
        borderWidth: 0,
        textStyle: { color: chart.tooltipText, fontSize: 11 },
        trigger: "axis",
      },
      xAxis: {
        axisLabel: { color: chart.axisLabel, fontSize: 11, interval: 4 },
        axisLine: { lineStyle: { color: chart.axisLine } },
        axisTick: { show: false },
        data: trend.map((point) => shortDay(point.date)),
        type: "category",
      },
      yAxis: {
        axisLabel: { color: chart.axisLabel, fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: chart.splitLine, type: "dashed" } },
        type: "value",
      },
    }),
    [chart, t, trend]
  );

  const distribution = overview?.distribution ?? [];
  const distTotal = distribution.reduce((sum, item) => sum + item.count, 0);
  const backendLabel = useCallback(
    (backend: string) =>
      backend === "sandbox_rpc"
        ? t("dashboard.sandboxRpc")
        : t("dashboard.inProcess"),
    [t]
  );
  const backendColor = useCallback(
    (backend: string) =>
      backend === "sandbox_rpc" ? chart.palette[1] : chart.palette[0],
    [chart]
  );
  const typeOption = useMemo(
    () => ({
      animationDuration: 550,
      series: [
        {
          avoidLabelOverlap: false,
          data: distribution.map((item) => ({
            itemStyle: { color: backendColor(item.backend) },
            name: backendLabel(item.backend),
            value: item.count,
          })),
          emphasis: { scale: false },
          label: {
            color: chart.donutCenter,
            fontSize: 21,
            fontWeight: 600,
            formatter: `${numberFormat.format(distTotal)}\n{small|${t("dashboard.totalTasks")}}`,
            lineHeight: 30,
            position: "center",
            rich: {
              small: {
                color: chart.donutCaption,
                fontSize: 11,
                fontWeight: 400,
              },
            },
            show: true,
          },
          labelLine: { show: false },
          radius: ["60%", "83%"],
          type: "pie",
        },
      ],
      tooltip: {
        backgroundColor: chart.tooltipBackground,
        borderWidth: 0,
        formatter: "{b}: {c} ({d}%)",
        textStyle: { color: chart.tooltipText, fontSize: 11 },
        trigger: "item",
      },
    }),
    [
      backendColor,
      backendLabel,
      chart,
      distTotal,
      distribution,
      numberFormat,
      t,
    ]
  );

  if (!overview) {
    return (
      <main className="min-w-0 flex-1 bg-background px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-12 lg:py-16">
        <div className="mx-auto max-w-[1180px]">
          <header>
            <h1 className="text-2xl font-semibold tracking-[-0.025em] text-foreground">
              {t("dashboard.overview")}
            </h1>
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-muted-foreground">
              {t("dashboard.manageEnterpriseAiCapabilitiesToolsDataModels")}
            </p>
          </header>
          {fetchError ? (
            <div className="mt-10 rounded-[14px] border border-border bg-card px-6 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                {t("adminApi.overviewLoadFailed")}
              </p>
              <Button className="mt-5" onClick={refresh} variant="outline">
                {t("common.retry")}
              </Button>
            </div>
          ) : (
            <div className="mt-16 flex justify-center">
              <Spinner className="size-6" />
            </div>
          )}
        </div>
      </main>
    );
  }

  const { metrics } = overview;
  const rateDelta =
    metrics.successRate.rate === null ||
    metrics.successRate.previousRate === null
      ? null
      : Math.round(
          (metrics.successRate.rate - metrics.successRate.previousRate) * 10
        ) / 10;

  const { services } = overview;
  const allOperational = services.every(
    (service) => service.status === "operational"
  );
  const worstService = services.some((s) => s.status === "error")
    ? "error"
    : services.some((s) => s.status === "degraded")
      ? "degraded"
      : "partial";

  return (
    <main className="min-w-0 flex-1 bg-background px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-12 lg:py-16">
      <div className="mx-auto max-w-[1180px]">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.025em] text-foreground">
              {t("dashboard.overview")}
            </h1>
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-muted-foreground">
              {t("dashboard.manageEnterpriseAiCapabilitiesToolsDataModels")}
            </p>
            {fetchError ? (
              <p className="mt-3 text-xs text-destructive">
                {t("adminApi.overviewLoadFailed")}
              </p>
            ) : null}
          </div>
          <Button
            aria-label={t("dashboard.refresh")}
            className="size-8 shrink-0"
            disabled={fetching}
            onClick={refresh}
            size="icon"
            variant="outline"
          >
            {fetching ? (
              <Spinner className="size-4" />
            ) : (
              <RefreshCwIcon className="size-4" />
            )}
          </Button>
        </header>

        <section className="mt-8 grid grid-cols-1 overflow-hidden rounded-[14px] border border-border bg-card sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            change={<DeltaBadge delta={metrics.tasks.changePct} />}
            icon={BoxIcon}
            iconClass="bg-primary/10 text-primary"
            label={t("dashboard.totalTasks")}
            value={numberFormat.format(metrics.tasks.total)}
          />
          <MetricCard
            change={
              <DeltaBadge
                delta={rateDelta}
                unit={` ${t("dashboard.percentagePoints")}`}
              />
            }
            icon={CheckCircle2Icon}
            iconClass="bg-muted text-foreground"
            label={t("dashboard.successRate")}
            value={
              metrics.successRate.rate === null
                ? "—"
                : `${metrics.successRate.rate}%`
            }
          />
          <MetricCard
            change={<DeltaBadge delta={metrics.activeUsers.changePct} />}
            icon={UsersIcon}
            iconClass="bg-muted text-foreground"
            label={t("dashboard.activeUsers")}
            value={numberFormat.format(metrics.activeUsers.current)}
          />
          <MetricCard
            change={<EnabledBadge count={metrics.skills.enabled} />}
            icon={DatabaseIcon}
            iconClass="bg-muted text-foreground"
            label={t("dashboard.publishedSkills")}
            value={numberFormat.format(metrics.skills.total)}
          />
          <MetricCard
            change={<EnabledBadge count={metrics.tools.enabled} />}
            icon={PackageCheckIcon}
            iconClass="bg-muted text-foreground"
            label={t("dashboard.connectedTools")}
            value={numberFormat.format(metrics.tools.total)}
          />
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <article className={cn(panelClass, "xl:col-span-5")}>
            <PanelHeader
              action={<RangeButton />}
              title={t("dashboard.taskTrends")}
            />
            <div className="flex items-center gap-5 px-5 pt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <i
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: chart.palette[0] }}
                />
                {t("dashboard.success")}
              </span>
              <span className="flex items-center gap-2">
                <i className="size-2.5 rounded-full bg-border" />
                {t("dashboard.failed")}
              </span>
            </div>
            <EChartsChart
              ariaLabel={t("dashboard.successfulAndFailedTasksOverTheLast")}
              className="h-[203px] w-full px-2"
              option={trendOption}
            />
          </article>

          <article className={cn(panelClass, "xl:col-span-4")}>
            <PanelHeader
              action={<RangeButton />}
              title={t("dashboard.taskDistribution")}
            />
            {distTotal === 0 ? (
              <div className="flex min-h-[225px] items-center justify-center text-xs text-muted-foreground">
                {t("dashboard.noData")}
              </div>
            ) : (
              <div className="flex min-h-[225px] items-center gap-2 px-4 py-3">
                <EChartsChart
                  ariaLabel={t("dashboard.taskTypeDistributionChart")}
                  className="h-[190px] min-w-0 flex-1"
                  option={typeOption}
                />
                <ul className="w-[145px] shrink-0 space-y-2.5">
                  {distribution.map((item) => (
                    <li
                      className="flex items-center gap-2 text-xs"
                      key={item.backend}
                    >
                      <i
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: backendColor(item.backend) }}
                      />
                      <span className="flex-1 text-muted-foreground">
                        {backendLabel(item.backend)}
                      </span>
                      <strong className="font-medium text-foreground">
                        {Math.round((item.count / distTotal) * 100)}%
                      </strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>

          <article className={cn(panelClass, "xl:col-span-3")}>
            <PanelHeader
              action={
                <span
                  className={cn(
                    "flex items-center gap-2 text-xs font-medium",
                    allOperational
                      ? "text-link"
                      : worstService === "error"
                        ? "text-destructive"
                        : worstService === "degraded"
                          ? "text-warning"
                          : "text-muted-foreground"
                  )}
                >
                  <i
                    className={cn(
                      "size-2.5 rounded-full bg-current",
                      !allOperational &&
                        worstService === "error" &&
                        "text-destructive"
                    )}
                  />
                  {allOperational
                    ? t("dashboard.allOperational")
                    : worstService === "error"
                      ? t("dashboard.servicesError")
                      : worstService === "degraded"
                        ? t("dashboard.statusDegraded")
                        : t("dashboard.servicesPartial")}
                </span>
              }
              title={t("dashboard.systemStatus")}
            />
            <ul className="px-5 py-1">
              {services.map((service) => {
                const meta = SERVICE_STATUS_META[service.status];
                return (
                  <li
                    className="flex h-[34px] items-center border-b border-border text-xs last:border-0"
                    key={service.key}
                  >
                    <CircleIcon
                      className={cn(
                        "mr-3 size-2.5 fill-current",
                        meta.className
                      )}
                    />
                    <span className="flex-1 text-muted-foreground">
                      {t(`dashboard.${SERVICE_LABEL_KEYS[service.key]}`)}
                    </span>
                    <span className={cn("font-medium", meta.className)}>
                      {t(`dashboard.${meta.labelKey}`)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </article>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <article className={cn(panelClass, "overflow-hidden xl:col-span-5")}>
            <PanelHeader
              action={<ViewAll />}
              title={t("dashboard.recentTasks")}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px] text-left text-[11px]">
                <thead className="bg-[var(--canvas-soft)] text-muted-foreground">
                  <tr>
                    {[
                      t("dashboard.task"),
                      t("common.user"),
                      t("common.type"),
                      t("common.status"),
                      t("dashboard.started"),
                      t("dashboard.duration"),
                    ].map((label) => (
                      <th className="h-8 px-4 font-medium" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overview.recentRuns.length === 0 ? (
                    <EmptyRow colSpan={6} />
                  ) : (
                    overview.recentRuns.map((run) => {
                      const meta =
                        RUN_STATUS_META[run.status as OverviewRunStatus] ??
                        RUN_STATUS_META.running;
                      return (
                        <tr
                          className="h-[42px] border-t border-border text-muted-foreground"
                          key={run.runId}
                        >
                          <td className="h-[36px] max-w-[220px] truncate px-4 font-medium text-foreground">
                            <span className="mr-2 inline-grid size-6 place-items-center rounded-md bg-muted text-foreground">
                              <FileBarChartIcon className="size-3.5" />
                            </span>
                            {run.chatTitle}
                          </td>
                          <td className="px-4">{run.userName ?? "—"}</td>
                          <td className="whitespace-nowrap px-4">
                            {backendLabel(run.backend)}
                          </td>
                          <td className="whitespace-nowrap px-4">
                            <span
                              className={cn(
                                "flex items-center gap-1.5",
                                meta.className
                              )}
                            >
                              <i className="size-2 rounded-full bg-current" />
                              {t(`dashboard.${meta.labelKey}`)}
                            </span>
                          </td>
                          <td
                            className="whitespace-nowrap px-4"
                            suppressHydrationWarning
                          >
                            {formatStamp(
                              run.createdAt,
                              {
                                today: t("dashboard.today"),
                                yesterday: t("dashboard.yesterday"),
                              },
                              locale,
                              english
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4">
                            {formatDuration(run.durationMs)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className={cn(panelClass, "xl:col-span-4")}>
            <PanelHeader
              action={<ViewAll href="/admin/skills" />}
              title={t("dashboard.recentSkills")}
            />
            <ol className="px-5 py-1">
              {overview.skills.length === 0 ? (
                <li className="flex h-16 items-center justify-center text-xs text-muted-foreground">
                  {t("dashboard.noData")}
                </li>
              ) : (
                overview.skills.map((item, index) => {
                  const Icon = SKILL_ICONS[index % SKILL_ICONS.length];
                  return (
                    <li
                      className="flex h-[49px] items-center gap-3"
                      key={item.name}
                    >
                      <span className="w-3 text-xs text-muted-foreground">
                        {index + 1}
                      </span>
                      <span
                        className={cn(
                          "grid size-8 place-items-center rounded-md",
                          index === 0
                            ? "text-primary bg-primary/10"
                            : "text-foreground bg-muted"
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-xs font-medium text-foreground">
                          {item.displayName}
                        </strong>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {item.description}
                        </span>
                      </span>
                      <span className="text-xs font-medium text-foreground">
                        {item.enabled
                          ? item.version || "—"
                          : t("dashboard.statusDisabled")}
                      </span>
                    </li>
                  );
                })
              )}
            </ol>
          </article>

          <article className={cn(panelClass, "xl:col-span-3")}>
            <PanelHeader
              action={<ViewAll />}
              title={t("dashboard.latestActivity")}
            />
            <ol className="relative px-5 py-2 before:absolute before:bottom-6 before:left-[23px] before:top-6 before:w-px before:bg-border">
              {overview.activities.length === 0 ? (
                <li className="flex h-16 items-center justify-center text-xs text-muted-foreground">
                  {t("dashboard.noData")}
                </li>
              ) : (
                overview.activities.map((activity) => {
                  const meta =
                    ACTIVITY_META[activity.type] ?? ACTIVITY_META.skill;
                  return (
                    <li
                      className="relative flex min-h-[48px] gap-3 pl-5"
                      key={`${activity.type}-${activity.at}-${activity.title}`}
                    >
                      <i
                        className={cn(
                          "absolute left-0 top-2 size-2.5 rounded-full ring-4 ring-card",
                          meta.className
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-xs font-medium text-foreground">
                          {activity.title}
                        </strong>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {t(`dashboard.${meta.labelKey}`)}
                        </span>
                      </span>
                      <time
                        className="shrink-0 pt-0.5 text-[10px] text-muted-foreground"
                        suppressHydrationWarning
                      >
                        {formatDistanceToNow(new Date(activity.at), {
                          addSuffix: true,
                          locale,
                        })}
                      </time>
                    </li>
                  );
                })
              )}
            </ol>
          </article>
        </section>
      </div>
    </main>
  );
}
