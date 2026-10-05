"use client";

import {
  ClockIcon,
  DatabaseIcon,
  MessageSquareIcon,
  RefreshCwIcon,
  UsersIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useMemo,
  useState,
} from "react";
import useSWR from "swr";
import { EChartsChart } from "@/components/admin/echarts-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  type TokenGroup,
  type TokenStatistics,
  tokenFilters,
} from "@/lib/admin/token-statistics";
import { getChartTheme } from "@/lib/chart-theme";

const number = (v: number | null) =>
  v === null ? "—" : Math.round(v).toLocaleString();
async function fetchStatistics(url: string): Promise<TokenStatistics> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Statistics unavailable");
  }
  return response.json();
}
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 rounded-xl shadow-none">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function TokenStatisticsPage({
  initialData,
}: {
  initialData: TokenStatistics;
}) {
  const t = useTranslations("tokenStatistics");
  const { resolvedTheme } = useTheme();
  const theme = useMemo(
    () => getChartTheme(resolvedTheme === "dark" ? "dark" : "light"),
    [resolvedTheme]
  );
  const [draft, setDraft] = useState(initialData.filters);
  const [filters, setFilters] = useState(initialData.filters);
  const [invalid, setInvalid] = useState(false);
  const key = `/api/admin/token-statistics?${new URLSearchParams(filters)}`;
  const initialKey = `/api/admin/token-statistics?${new URLSearchParams(initialData.filters)}`;
  const { data, error, isValidating, mutate } = useSWR(key, fetchStatistics, {
    fallbackData: key === initialKey ? initialData : undefined,
    revalidateOnFocus: false,
  });
  const refresh = useCallback(() => {
    mutate().catch(() => undefined);
  }, [mutate]);
  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const parsed = tokenFilters.safeParse(draft);
      setInvalid(!parsed.success);
      if (parsed.success) {
        setFilters(parsed.data);
        if (JSON.stringify(parsed.data) === JSON.stringify(filters)) {
          refresh();
        }
      }
    },
    [draft, filters, refresh]
  );
  const updateDraft = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = event.target;
      setDraft((current) => ({ ...current, [name]: value }));
    },
    []
  );
  const trendOption = useMemo(
    () => ({
      color: theme.palette,
      grid: { bottom: 36, left: 65, right: 16, top: 54 },
      legend: {
        formatter: (name: string) => name.split(" / ").at(-1) ?? name,
        textStyle: { color: theme.axisLabel },
        top: 0,
        type: "scroll",
      },
      series: data?.models.map((model, index) => ({
        barMaxWidth: 24,
        data: data.trend.map((r) => r.values[index]),
        name: model.key,
        stack: "tokens",
        type: "bar",
      })),
      tooltip: {
        backgroundColor: theme.tooltipBackground,
        renderMode: "richText",
        textStyle: { color: theme.tooltipText },
        trigger: "axis",
      },
      xAxis: {
        axisLabel: { color: theme.axisLabel },
        axisLine: { lineStyle: { color: theme.axisLine } },
        axisTick: { show: false },
        data: data?.trend.map((r) => r.day.slice(5).replace("-", "/")),
        type: "category",
      },
      yAxis: {
        axisLabel: {
          color: theme.axisLabel,
          formatter: (v: number) =>
            Intl.NumberFormat(undefined, { notation: "compact" }).format(v),
        },
        splitLine: { lineStyle: { color: theme.splitLine, type: "dashed" } },
        type: "value",
      },
    }),
    [data, theme]
  );
  const pieOption = useMemo(
    () => ({
      color: theme.palette,
      graphic: [
        {
          left: "center",
          style: {
            fill: theme.donutCenter,
            fontSize: 24,
            fontWeight: 600,
            text:
              data?.summary.tokens === null
                ? "—"
                : Intl.NumberFormat(undefined, { notation: "compact" }).format(
                    data?.summary.tokens ?? 0
                  ),
          },
          top: "42%",
          type: "text",
        },
        {
          left: "center",
          style: {
            fill: theme.donutCaption,
            fontSize: 12,
            text: t("totalToken"),
          },
          top: "57%",
          type: "text",
        },
      ],
      series: [
        {
          data: data?.models
            .filter((m) => m.tokens !== null)
            .map((m) => ({ name: m.key, value: m.tokens })),
          itemStyle: {
            borderColor: theme.axisLine,
            borderRadius: 3,
            borderWidth: 2,
          },
          label: { show: false },
          radius: ["64%", "85%"],
          type: "pie",
        },
      ],
      tooltip: {
        formatter: "{b}\n{c} Token ({d}%)",
        renderMode: "richText",
        trigger: "item",
      },
    }),
    [data, theme, t]
  );
  const change = (value: number | null) =>
    value === null
      ? t("noComparison")
      : `${value >= 0 ? "↑" : "↓"} ${Math.abs(value).toFixed(1)}%`;
  const rankings = (rows: TokenGroup[], color: string) => (
    <div className="flex max-h-64 flex-col gap-4 overflow-y-auto">
      {rows.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      )}
      {rows.map((row) => (
        <div
          className="grid grid-cols-[minmax(0,1fr)_minmax(50px,1fr)_auto] items-center gap-3 text-sm"
          key={row.id}
        >
          <span className="truncate" title={row.key}>
            {row.key}
          </span>
          <div className="h-2.5 overflow-hidden rounded-sm bg-muted">
            <div
              className="h-full rounded-sm"
              style={{
                backgroundColor: color,
                width: `${((row.tokens ?? 0) / Math.max(1, ...rows.map((r) => r.tokens ?? 0))) * 100}%`,
              }}
            />
          </div>
          <span className="text-right text-xs tabular-nums text-muted-foreground">
            {number(row.tokens)}{" "}
            <span className="ml-2">
              {data?.summary.tokens
                ? `${(((row.tokens ?? 0) / data.summary.tokens) * 100).toFixed(0)}%`
                : "—"}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-[-0.025em]">
          {t("title")}
        </h1>
        <form className="flex flex-wrap items-end gap-2" onSubmit={submit}>
          <label
            className="flex flex-col gap-1 text-xs text-muted-foreground"
            htmlFor="token-start"
          >
            <span className="sr-only">{t("start")}</span>
            <Input
              id="token-start"
              name="start"
              onChange={updateDraft}
              required
              type="date"
              value={draft.start}
            />
          </label>
          <label
            className="flex flex-col gap-1 text-xs text-muted-foreground"
            htmlFor="token-end"
          >
            <span className="sr-only">{t("end")}</span>
            <Input
              id="token-end"
              name="end"
              onChange={updateDraft}
              required
              type="date"
              value={draft.end}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="sr-only">{t("organization")}</span>
            <select
              className="h-9 max-w-48 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              name="department"
              onChange={updateDraft}
              value={draft.department}
            >
              <option value="all">{t("all")}</option>
              <option value="none">{t("unassigned")}</option>
              {initialData.departmentOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={isValidating} type="submit" variant="outline">
            <RefreshCwIcon data-icon="inline-start" />
            {t("apply")}
          </Button>
        </form>
      </header>
      {!!invalid && (
        <p className="text-sm text-destructive" role="alert">
          {t("invalid")}
        </p>
      )}
      {!!error && (
        <div
          className="flex items-center gap-3 text-sm text-destructive"
          role="alert"
        >
          {t("error")}
          <Button onClick={refresh} variant="outline">
            {t("retry")}
          </Button>
        </div>
      )}
      {!!isValidating && (
        <p className="text-sm text-muted-foreground" role="status">
          {t("loading")}
        </p>
      )}
      {!!data && (
        <>
          <p className="sr-only">
            {data.filters.start} ~ {data.filters.end} ·{" "}
            {t("coverage", {
              completed: data.summary.completed,
              recorded: data.summary.recorded,
            })}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                icon: DatabaseIcon,
                label: "tokens",
                value: data.summary.tokens,
              },
              { icon: UsersIcon, label: "users", value: data.summary.users },
              {
                icon: MessageSquareIcon,
                label: "conversations",
                value: data.summary.conversations,
              },
              {
                icon: ClockIcon,
                label: "average",
                value: data.summary.average,
              },
            ].map(({ label, value, icon: Icon }) => (
              <Card className="rounded-xl shadow-none" key={label}>
                <CardContent className="flex flex-col gap-4 pt-5">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary">
                      <Icon className="size-5" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t(label)}</p>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <p
                      className="min-w-0 truncate text-2xl font-semibold tabular-nums"
                      title={number(value)}
                    >
                      {number(value)}
                    </p>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      <p>
                        {change(
                          data.changes[label as keyof typeof data.changes]
                        )}
                      </p>
                      <p className="mt-1">{t("previous")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Panel title={t("trend")}>
            <EChartsChart
              ariaLabel={t("trend")}
              className="h-64 w-full"
              option={trendOption}
            />
          </Panel>
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title={t("models")}>
              <div className="flex flex-wrap items-center gap-3">
                <EChartsChart
                  ariaLabel={t("models")}
                  className="h-48 w-48 shrink-0"
                  option={pieOption}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  {data.models.map((m, i) => (
                    <div
                      className="flex items-center gap-2 text-xs"
                      key={m.key}
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            theme.palette[i % theme.palette.length],
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate" title={m.key}>
                        {m.key.split(" / ").at(-1)}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {number(m.tokens)}
                      </span>
                    </div>
                  ))}
                  {data.models.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {t("empty")}
                    </p>
                  )}
                </div>
              </div>
            </Panel>
            <Panel title={t("departments")}>
              {rankings(data.departments, theme.palette[0])}
            </Panel>
            <Panel title={t("roles")}>
              {rankings(data.roles, theme.palette[2])}
            </Panel>
          </div>
          <Panel title={t("details")}>
            <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                  <tr>
                    {[
                      "rank",
                      "department",
                      "users",
                      "conversations",
                      "tokens",
                      "average",
                      "change",
                    ].map((column) => (
                      <th
                        className="px-4 py-3 font-medium"
                        key={column}
                        scope="col"
                      >
                        {t(column)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.departments.map((row, i) => (
                    <tr
                      className="border-b border-border last:border-0"
                      key={row.id}
                    >
                      <td className="px-4 py-3">{i + 1}</td>
                      <th className="px-4 py-3 font-normal" scope="row">
                        {row.key}
                      </th>
                      <td className="px-4 py-3 tabular-nums">
                        {number(row.users)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {number(row.conversations)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {number(row.tokens)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {number(
                          row.tokens === null ? null : row.tokens / row.users
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {change(row.change)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.departments.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </p>
              )}
            </div>
          </Panel>
          <p className="text-xs leading-6 text-muted-foreground">{t("note")}</p>
        </>
      )}
    </main>
  );
}
