"use client";

import type { EChartsCoreOption } from "echarts/core";
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
  SearchCheckIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EChartsChart } from "@/components/management/echarts-chart";
import { usePreferences } from "@/components/preferences-provider";
import { getChartTheme } from "@/lib/chart-theme";
import { cn } from "@/lib/utils";

const metrics = [
  {
    change: "12%",
    icon: BoxIcon,
    iconClass: "bg-primary/10 text-primary",
    label: "总任务数",
    value: "12,438",
  },
  {
    change: "2.1%",
    icon: CheckCircle2Icon,
    iconClass: "bg-muted text-foreground",
    label: "任务成功率",
    value: "96.2%",
  },
  {
    change: "18%",
    icon: UsersIcon,
    iconClass: "bg-muted text-foreground",
    label: "活跃用户",
    value: "892",
  },
  {
    change: "24%",
    icon: DatabaseIcon,
    iconClass: "bg-muted text-foreground",
    label: "已上架 Skill",
    value: "156",
  },
  {
    change: "8%",
    icon: PackageCheckIcon,
    iconClass: "bg-muted text-foreground",
    label: "接入工具",
    value: "78",
  },
] as const;

const trendSuccess = [
  214, 168, 174, 203, 258, 246, 251, 262, 222, 248, 277, 291, 306, 337, 296,
  321, 365, 388, 462, 397, 352, 418, 477, 506, 386, 348, 402, 468, 462, 565,
  581,
];
const trendFailed = [
  94, 52, 62, 51, 79, 83, 76, 74, 58, 82, 66, 112, 104, 137, 85, 96, 121, 145,
  206, 132, 105, 183, 129, 165, 82, 92, 74, 145, 139, 168, 221,
];

const taskTypes = [
  { name: "数据分析", value: 28 },
  { name: "文档处理", value: 20 },
  { name: "内容生成", value: 18 },
  { name: "办公效率", value: 14 },
  { name: "业务系统", value: 12 },
  { name: "其他", value: 8 },
];

const recentTasks = [
  ["生成8月经营分析报告", "张三", "数据分析", "已完成", "今天 14:32", "2m 34s"],
  ["审核XX项目合同", "李四", "文档处理", "已完成", "今天 11:20", "1m 12s"],
  ["整理会议纪要", "王五", "内容生成", "运行中", "今天 10:15", "-"],
  ["对比三家供应商方案", "赵六", "数据分析", "失败", "今天 09:48", "3m 21s"],
  ["生成产品宣传PPT", "陈七", "内容生成", "已完成", "昨天 16:20", "2m 08s"],
] as const;

const popularSkills = [
  [
    "数据分析",
    "自然语言分析企业数据",
    "2.4k",
    ActivityIcon,
    "text-primary bg-primary/10",
  ],
  [
    "PPT 生成",
    "一键生成汇报PPT",
    "1.8k",
    PresentationIcon,
    "text-foreground bg-muted",
  ],
  [
    "文档撰写",
    "生成方案、报告、邮件等",
    "1.6k",
    FileTextIcon,
    "text-foreground bg-muted",
  ],
  [
    "合同审核",
    "风险识别与条款审查",
    "1.2k",
    SearchCheckIcon,
    "text-foreground bg-muted",
  ],
  [
    "会议纪要",
    "生成结构化会议纪要",
    "980",
    UsersIcon,
    "text-foreground bg-muted",
  ],
] as const;

const activities = [
  ["新版本发布", "Skill「数据分析」已发布 v2.1", "2分钟前", "bg-primary"],
  ["用户加入", "张三 加入了「经营分析部」", "15分钟前", "bg-primary"],
  ["工具接入", "已接入新的 Oracle 数据源", "1小时前", "bg-link"],
  ["权限变更", "更新了「财务部」的数据访问权限", "2小时前", "bg-warning"],
  ["系统告警", "模型服务 GPU 使用率超过 80%", "3小时前", "bg-destructive"],
] as const;

const systemServices = [
  "Runtime 服务",
  "模型服务",
  "数据库连接",
  "存储服务",
  "消息队列",
  "安全策略",
];

const panelClass = "rounded-xl border border-border bg-card";

const englishDashboardCopy: Record<string, string> = {
  "1小时前": "1 hour ago",
  "2分钟前": "2 min ago",
  "2小时前": "2 hours ago",
  "3小时前": "3 hours ago",
  "15分钟前": "15 min ago",
  "PPT 生成": "PPT generation",
  "Runtime 服务": "Runtime service",
  "Skill「数据分析」已发布 v2.1": "Data Analysis skill v2.1 was published",
  一键生成汇报PPT: "Generate presentation decks in one click",
  业务系统: "Business systems",
  "今天 09:48": "Today 09:48",
  "今天 10:15": "Today 10:15",
  "今天 11:20": "Today 11:20",
  "今天 14:32": "Today 14:32",
  任务成功率: "Task success rate",
  会议纪要: "Meeting notes",
  其他: "Other",
  内容生成: "Content generation",
  办公效率: "Productivity",
  合同审核: "Contract review",
  失败: "Failed",
  存储服务: "Storage service",
  安全策略: "Security policy",
  审核XX项目合同: "Review the XX project contract",
  对比三家供应商方案: "Compare three vendor proposals",
  工具接入: "Tool connected",
  "已上架 Skill": "Published skills",
  已完成: "Completed",
  "已接入新的 Oracle 数据源": "A new Oracle data source was connected",
  "张三 加入了「经营分析部」": "Zhang San joined Business Analysis",
  总任务数: "Total tasks",
  接入工具: "Connected tools",
  数据分析: "Data analysis",
  数据库连接: "Database connection",
  整理会议纪要: "Organize meeting notes",
  文档处理: "Document processing",
  文档撰写: "Document writing",
  新版本发布: "New release",
  "昨天 16:20": "Yesterday 16:20",
  "更新了「财务部」的数据访问权限": "Finance data access was updated",
  权限变更: "Permission updated",
  模型服务: "Model service",
  "模型服务 GPU 使用率超过 80%": "Model service GPU usage exceeded 80%",
  活跃用户: "Active users",
  消息队列: "Message queue",
  生成8月经营分析报告: "Generate August business analysis report",
  生成产品宣传PPT: "Create a product marketing deck",
  "生成方案、报告、邮件等": "Create proposals, reports, emails, and more",
  生成结构化会议纪要: "Create structured meeting notes",
  用户加入: "User joined",
  系统告警: "System alert",
  自然语言分析企业数据: "Analyze enterprise data with natural language",
  运行中: "Running",
  风险识别与条款审查: "Risk identification and clause review",
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

function ViewAll({ href = "/management" }: { href?: string }) {
  const { translate } = usePreferences();

  return (
    <Link
      className="flex items-center gap-1 text-xs font-medium text-link hover:text-link-deep"
      href={href}
    >
      {translate("查看全部", "View all")}{" "}
      <ArrowRightIcon className="size-3.5" />
    </Link>
  );
}

function RangeButton() {
  const { translate } = usePreferences();

  return (
    <button
      className="flex h-8 items-center gap-2 rounded-md border border-[var(--hairline-strong)] bg-card px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      type="button"
    >
      {translate("近 30 天", "Last 30 days")}{" "}
      <ChevronDownIcon className="size-3.5" />
    </button>
  );
}

export function DashboardOverview() {
  const { language, translate } = usePreferences();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const localize = useCallback(
    (value: string) =>
      language === "zh" ? value : (englishDashboardCopy[value] ?? value),
    [language]
  );
  const { resolvedTheme } = useTheme();
  const chart = useMemo(
    () => getChartTheme(mounted && resolvedTheme === "dark" ? "dark" : "light"),
    [mounted, resolvedTheme]
  );
  const typeColors = useMemo(() => [...chart.palette, chart.other], [chart]);

  const trendOption = useMemo<EChartsCoreOption>(
    () => ({
      animationDuration: 550,
      color: [chart.palette[0], chart.neutralSeries],
      grid: { bottom: 24, containLabel: true, left: 12, right: 10, top: 20 },
      series: [
        {
          barMaxWidth: 11,
          data: trendSuccess,
          emphasis: { disabled: true },
          name: translate("成功", "Success"),
          stack: "tasks",
          type: "bar",
        },
        {
          barMaxWidth: 11,
          data: trendFailed,
          emphasis: { disabled: true },
          name: translate("失败", "Failed"),
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
        data: Array.from({ length: 31 }, (_, index) => `8/${index + 1}`),
        type: "category",
      },
      yAxis: {
        axisLabel: { color: chart.axisLabel, fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
        interval: 200,
        max: 800,
        splitLine: { lineStyle: { color: chart.splitLine, type: "dashed" } },
        type: "value",
      },
    }),
    [chart, translate]
  );

  const typeOption = useMemo<EChartsCoreOption>(
    () => ({
      animationDuration: 550,
      color: typeColors,
      series: [
        {
          avoidLabelOverlap: false,
          data: taskTypes.map((item) => ({
            name: localize(item.name),
            value: item.value,
          })),
          emphasis: { scale: false },
          label: {
            color: chart.donutCenter,
            fontSize: 21,
            fontWeight: 600,
            formatter: `12,438\n{small|${translate("总任务数", "Total tasks")}}`,
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
        formatter: "{b}: {c}%",
        textStyle: { color: chart.tooltipText, fontSize: 11 },
        trigger: "item",
      },
    }),
    [chart, localize, translate, typeColors]
  );

  return (
    <main className="min-w-0 flex-1 bg-background px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-12 lg:py-16">
      <div className="mx-auto max-w-[1180px]">
        <header>
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-foreground">
            {translate("概览", "Overview")}
          </h1>
          <p className="mt-2 max-w-3xl text-[14px] leading-6 text-muted-foreground">
            {translate(
              "统一管理企业的 AI 能力、工具、数据、模型与权限，保障 AI 能力安全、高效、合规运行。",
              "Manage enterprise AI capabilities, tools, data, models, and access from one place."
            )}
          </p>
        </header>

        <section className="mt-8 grid grid-cols-1 overflow-hidden rounded-[14px] border border-border bg-card sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article
                className="min-h-[126px] border-b border-border p-5 last:border-b-0 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0 xl:[&:nth-child(odd)]:border-r"
                key={metric.label}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "grid size-11 place-items-center rounded-xl",
                      metric.iconClass
                    )}
                  >
                    <Icon className="size-6" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {localize(metric.label)}
                  </p>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <strong className="text-[27px] font-medium leading-none tracking-[-0.025em] text-foreground tabular-nums">
                    {metric.value}
                  </strong>
                  <div className="pb-0.5 text-right text-[12px]">
                    <p className="font-semibold text-link">↑ {metric.change}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {translate("较上月", "vs. last month")}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <article className={cn(panelClass, "xl:col-span-5")}>
            <PanelHeader
              action={<RangeButton />}
              title={translate("任务趋势", "Task trends")}
            />
            <div className="flex items-center gap-5 px-5 pt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <i
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: chart.palette[0] }}
                />
                {translate("成功", "Success")}
              </span>
              <span className="flex items-center gap-2">
                <i className="size-2.5 rounded-full bg-border" />
                {translate("失败", "Failed")}
              </span>
            </div>
            <EChartsChart
              ariaLabel={translate(
                "近三十天成功与失败任务趋势柱状图",
                "Successful and failed tasks over the last 30 days"
              )}
              className="h-[203px] w-full px-2"
              option={trendOption}
            />
          </article>

          <article className={cn(panelClass, "xl:col-span-4")}>
            <PanelHeader
              action={<RangeButton />}
              title={translate("任务类型分布", "Task distribution")}
            />
            <div className="flex min-h-[225px] items-center gap-2 px-4 py-3">
              <EChartsChart
                ariaLabel={translate(
                  "任务类型分布环形图",
                  "Task type distribution chart"
                )}
                className="h-[190px] min-w-0 flex-1"
                option={typeOption}
              />
              <ul className="w-[145px] shrink-0 space-y-2.5">
                {taskTypes.map((item, index) => (
                  <li
                    className="flex items-center gap-2 text-xs"
                    key={item.name}
                  >
                    <i
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: typeColors[index] }}
                    />
                    <span className="flex-1 text-muted-foreground">
                      {localize(item.name)}
                    </span>
                    <strong className="font-medium text-foreground">
                      {item.value}%
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <article className={cn(panelClass, "xl:col-span-3")}>
            <PanelHeader
              action={
                <span className="flex items-center gap-2 text-xs font-medium text-link">
                  <i className="size-2.5 rounded-full bg-link" />
                  {translate("全部正常", "All operational")}
                </span>
              }
              title={translate("系统状态", "System status")}
            />
            <ul className="px-5 py-1">
              {systemServices.map((service) => (
                <li
                  className="flex h-[34px] items-center border-b border-border text-xs last:border-0"
                  key={service}
                >
                  <CircleIcon className="mr-3 size-2.5 fill-link text-link" />
                  <span className="flex-1 text-muted-foreground">
                    {localize(service)}
                  </span>
                  <span className="font-medium text-link">
                    {translate("正常", "Operational")}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <article className={cn(panelClass, "overflow-hidden xl:col-span-5")}>
            <PanelHeader
              action={<ViewAll />}
              title={translate("最近任务", "Recent tasks")}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px] text-left text-[11px]">
                <thead className="bg-[var(--canvas-soft)] text-muted-foreground">
                  <tr>
                    {[
                      translate("任务名称", "Task"),
                      translate("用户", "User"),
                      translate("类型", "Type"),
                      translate("状态", "Status"),
                      translate("开始时间", "Started"),
                      translate("时长", "Duration"),
                    ].map((label) => (
                      <th className="h-8 px-4 font-medium" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentTasks.map((task, index) => (
                    <tr
                      className="h-[42px] border-t border-border text-muted-foreground"
                      key={task[0]}
                    >
                      <td className="h-[36px] whitespace-nowrap px-4 font-medium text-foreground">
                        <span
                          className={cn(
                            "mr-2 inline-grid size-6 place-items-center rounded-md",
                            index % 3 === 0
                              ? "bg-primary/10 text-primary"
                              : index % 3 === 1
                                ? "bg-muted text-foreground"
                                : "bg-muted text-foreground"
                          )}
                        >
                          <FileBarChartIcon className="size-3.5" />
                        </span>
                        {localize(task[0])}
                      </td>
                      <td className="px-4">{task[1]}</td>
                      <td className="whitespace-nowrap px-4">
                        {localize(task[2])}
                      </td>
                      <td className="whitespace-nowrap px-4">
                        <span
                          className={cn(
                            "flex items-center gap-1.5",
                            task[3] === "已完成"
                              ? "text-link"
                              : task[3] === "运行中"
                                ? "text-warning"
                                : "text-destructive"
                          )}
                        >
                          <i className="size-2 rounded-full bg-current" />
                          {localize(task[3])}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4">
                        {localize(task[4])}
                      </td>
                      <td className="whitespace-nowrap px-4">{task[5]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className={cn(panelClass, "xl:col-span-4")}>
            <PanelHeader
              action={<ViewAll href="/management/skills" />}
              title={translate("热门 Skill", "Popular skills")}
            />
            <ol className="px-5 py-1">
              {popularSkills.map(
                ([name, description, count, Icon, iconClass], index) => (
                  <li className="flex h-[49px] items-center gap-3" key={name}>
                    <span className="w-3 text-xs text-muted-foreground">
                      {index + 1}
                    </span>
                    <span
                      className={cn(
                        "grid size-8 place-items-center rounded-md",
                        iconClass
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-xs font-medium text-foreground">
                        {localize(name)}
                      </strong>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {localize(description)}
                      </span>
                    </span>
                    <span className="text-xs font-medium text-foreground">
                      {count}
                    </span>
                  </li>
                )
              )}
            </ol>
          </article>

          <article className={cn(panelClass, "xl:col-span-3")}>
            <PanelHeader
              action={<ViewAll />}
              title={translate("最新动态", "Latest activity")}
            />
            <ol className="relative px-5 py-2 before:absolute before:bottom-6 before:left-[23px] before:top-6 before:w-px before:bg-border">
              {activities.map(([title, description, time, color]) => (
                <li
                  className="relative flex min-h-[48px] gap-3 pl-5"
                  key={title}
                >
                  <i
                    className={cn(
                      "absolute left-0 top-2 size-2.5 rounded-full ring-4 ring-card",
                      color
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <strong className="block text-xs font-medium text-foreground">
                      {localize(title)}
                    </strong>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {localize(description)}
                    </span>
                  </span>
                  <time className="shrink-0 pt-0.5 text-[10px] text-muted-foreground">
                    {localize(time)}
                  </time>
                </li>
              ))}
            </ol>
          </article>
        </section>
      </div>
    </main>
  );
}
