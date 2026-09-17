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
import { useMemo } from "react";
import { EChartsChart } from "@/components/management/echarts-chart";
import { cn } from "@/lib/utils";

const metrics = [
  {
    change: "12%",
    icon: BoxIcon,
    iconClass: "bg-blue-50 text-blue-600",
    label: "总任务数",
    value: "12,438",
  },
  {
    change: "2.1%",
    icon: CheckCircle2Icon,
    iconClass: "bg-emerald-50 text-emerald-600",
    label: "任务成功率",
    value: "96.2%",
  },
  {
    change: "18%",
    icon: UsersIcon,
    iconClass: "bg-violet-50 text-violet-600",
    label: "活跃用户",
    value: "892",
  },
  {
    change: "24%",
    icon: DatabaseIcon,
    iconClass: "bg-sky-50 text-sky-600",
    label: "已上架 Skill",
    value: "156",
  },
  {
    change: "8%",
    icon: PackageCheckIcon,
    iconClass: "bg-orange-50 text-orange-600",
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
  { color: "#347ff4", name: "数据分析", value: 28 },
  { color: "#24bd7a", name: "文档处理", value: 20 },
  { color: "#8664ef", name: "内容生成", value: 18 },
  { color: "#f7b63d", name: "办公效率", value: 14 },
  { color: "#64b5ed", name: "业务系统", value: 12 },
  { color: "#dfe5ef", name: "其他", value: 8 },
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
    "text-emerald-600 bg-emerald-50",
  ],
  [
    "PPT 生成",
    "一键生成汇报PPT",
    "1.8k",
    PresentationIcon,
    "text-orange-600 bg-orange-50",
  ],
  [
    "文档撰写",
    "生成方案、报告、邮件等",
    "1.6k",
    FileTextIcon,
    "text-blue-600 bg-blue-50",
  ],
  [
    "合同审核",
    "风险识别与条款审查",
    "1.2k",
    SearchCheckIcon,
    "text-violet-600 bg-violet-50",
  ],
  [
    "会议纪要",
    "生成结构化会议纪要",
    "980",
    UsersIcon,
    "text-purple-600 bg-purple-50",
  ],
] as const;

const activities = [
  ["新版本发布", "Skill「数据分析」已发布 v2.1", "2分钟前", "bg-blue-500"],
  ["用户加入", "张三 加入了「经营分析部」", "15分钟前", "bg-blue-500"],
  ["工具接入", "已接入新的 Oracle 数据源", "1小时前", "bg-emerald-500"],
  ["权限变更", "更新了「财务部」的数据访问权限", "2小时前", "bg-amber-700"],
  ["系统告警", "模型服务 GPU 使用率超过 80%", "3小时前", "bg-red-500"],
] as const;

const systemServices = [
  "Runtime 服务",
  "模型服务",
  "数据库连接",
  "存储服务",
  "消息队列",
  "安全策略",
];

const panelClass =
  "rounded-xl border border-[#e4eaf2] bg-white shadow-[0_1px_2px_rgba(20,44,84,0.025)]";

function PanelHeader({
  action,
  title,
}: {
  action?: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex h-12 items-center justify-between border-b border-[#edf1f6] px-5">
      <h2 className="text-[16px] font-semibold tracking-[-0.015em] text-[#17213a]">
        {title}
      </h2>
      {action}
    </div>
  );
}

function ViewAll({ href = "/management" }: { href?: string }) {
  return (
    <Link
      className="flex items-center gap-1 text-xs font-medium text-[#2475f4] hover:text-[#125fda]"
      href={href}
    >
      查看全部 <ArrowRightIcon className="size-3.5" />
    </Link>
  );
}

function RangeButton() {
  return (
    <button
      className="flex h-8 items-center gap-2 rounded-lg border border-[#dfe7f2] bg-white px-3 text-xs text-[#61769a] transition-colors hover:bg-[#f7f9fd]"
      type="button"
    >
      近 30 天 <ChevronDownIcon className="size-3.5" />
    </button>
  );
}

export function DashboardOverview() {
  const trendOption = useMemo<EChartsCoreOption>(
    () => ({
      animationDuration: 550,
      color: ["#347ff4", "#dfe5ef"],
      grid: { bottom: 24, containLabel: true, left: 12, right: 10, top: 20 },
      series: [
        {
          barMaxWidth: 11,
          data: trendSuccess,
          emphasis: { disabled: true },
          name: "成功",
          stack: "tasks",
          type: "bar",
        },
        {
          barMaxWidth: 11,
          data: trendFailed,
          emphasis: { disabled: true },
          name: "失败",
          stack: "tasks",
          type: "bar",
        },
      ],
      tooltip: {
        backgroundColor: "#17213a",
        borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 11 },
        trigger: "axis",
      },
      xAxis: {
        axisLabel: { color: "#7183a1", fontSize: 11, interval: 4 },
        axisLine: { lineStyle: { color: "#dfe6ef" } },
        axisTick: { show: false },
        data: Array.from({ length: 31 }, (_, index) => `8/${index + 1}`),
        type: "category",
      },
      yAxis: {
        axisLabel: { color: "#7183a1", fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
        interval: 200,
        max: 800,
        splitLine: { lineStyle: { color: "#e8edf4", type: "dashed" } },
        type: "value",
      },
    }),
    []
  );

  const typeOption = useMemo<EChartsCoreOption>(
    () => ({
      animationDuration: 550,
      color: taskTypes.map((item) => item.color),
      series: [
        {
          avoidLabelOverlap: false,
          data: taskTypes.map((item) => ({
            name: item.name,
            value: item.value,
          })),
          emphasis: { scale: false },
          label: {
            color: "#17213a",
            fontSize: 21,
            fontWeight: 700,
            formatter: "12,438\n{small|总任务数}",
            lineHeight: 30,
            position: "center",
            rich: {
              small: { color: "#8090aa", fontSize: 11, fontWeight: 400 },
            },
            show: true,
          },
          labelLine: { show: false },
          radius: ["60%", "83%"],
          type: "pie",
        },
      ],
      tooltip: {
        backgroundColor: "#17213a",
        borderWidth: 0,
        formatter: "{b}: {c}%",
        textStyle: { color: "#fff", fontSize: 11 },
        trigger: "item",
      },
    }),
    []
  );

  return (
    <main className="min-w-0 flex-1 bg-[#f9fbfe] px-5 py-7 sm:px-7 lg:px-9 lg:py-6">
      <div className="mx-auto max-w-[1480px]">
        <header>
          <h1 className="text-[30px] font-bold tracking-[-0.04em] text-[#141c31]">
            概览
          </h1>
          <p className="mt-1 text-[15px] text-[#597096]">
            统一管理企业的 AI 能力、工具、数据、模型与权限，保障 AI
            能力安全、高效、合规运行。
          </p>
        </header>

        <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article
                className={cn(panelClass, "min-h-[132px] p-5")}
                key={metric.label}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "grid size-11 place-items-center rounded-xl",
                      metric.iconClass
                    )}
                  >
                    <Icon className="size-6" strokeWidth={2} />
                  </div>
                  <p className="text-[13px] font-medium text-[#627494]">
                    {metric.label}
                  </p>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <strong className="text-[27px] leading-none tracking-[-0.035em] text-[#11182d]">
                    {metric.value}
                  </strong>
                  <div className="pb-0.5 text-right text-[12px]">
                    <p className="font-semibold text-[#07af67]">
                      ↑ {metric.change}
                    </p>
                    <p className="mt-0.5 text-[#8190a8]">较上月</p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
          <article className={cn(panelClass, "xl:col-span-5")}>
            <PanelHeader action={<RangeButton />} title="任务趋势" />
            <div className="flex items-center gap-5 px-5 pt-3 text-xs text-[#5e7294]">
              <span className="flex items-center gap-2">
                <i className="size-2.5 rounded-full bg-[#347ff4]" />
                成功
              </span>
              <span className="flex items-center gap-2">
                <i className="size-2.5 rounded-full bg-[#dfe5ef]" />
                失败
              </span>
            </div>
            <EChartsChart
              ariaLabel="近三十天成功与失败任务趋势柱状图"
              className="h-[203px] w-full px-2"
              option={trendOption}
            />
          </article>

          <article className={cn(panelClass, "xl:col-span-4")}>
            <PanelHeader action={<RangeButton />} title="任务类型分布" />
            <div className="flex min-h-[225px] items-center gap-2 px-4 py-3">
              <EChartsChart
                ariaLabel="任务类型分布环形图"
                className="h-[190px] min-w-0 flex-1"
                option={typeOption}
              />
              <ul className="w-[145px] shrink-0 space-y-2.5">
                {taskTypes.map((item) => (
                  <li
                    className="flex items-center gap-2 text-xs"
                    key={item.name}
                  >
                    <i
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="flex-1 text-[#536888]">{item.name}</span>
                    <strong className="font-semibold text-[#263552]">
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
                <span className="flex items-center gap-2 text-xs font-medium text-emerald-600">
                  <i className="size-2.5 rounded-full bg-emerald-500" />
                  全部正常
                </span>
              }
              title="系统状态"
            />
            <ul className="px-5 py-1">
              {systemServices.map((service) => (
                <li
                  className="flex h-[34px] items-center border-b border-[#edf1f6] text-xs last:border-0"
                  key={service}
                >
                  <CircleIcon className="mr-3 size-2.5 fill-emerald-500 text-emerald-500" />
                  <span className="flex-1 text-[#435879]">{service}</span>
                  <span className="font-medium text-emerald-600">正常</span>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
          <article className={cn(panelClass, "overflow-hidden xl:col-span-5")}>
            <PanelHeader action={<ViewAll />} title="最近任务" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px] text-left text-[11px]">
                <thead className="bg-[#f7f9fc] text-[#7183a1]">
                  <tr>
                    {[
                      "任务名称",
                      "用户",
                      "类型",
                      "状态",
                      "开始时间",
                      "时长",
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
                      className="h-[42px] border-t border-[#edf1f6] text-[#385070]"
                      key={task[0]}
                    >
                      <td className="h-[36px] whitespace-nowrap px-4 font-medium text-[#243653]">
                        <span
                          className={cn(
                            "mr-2 inline-grid size-6 place-items-center rounded-md",
                            index % 3 === 0
                              ? "bg-blue-50 text-blue-600"
                              : index % 3 === 1
                                ? "bg-orange-50 text-orange-500"
                                : "bg-violet-50 text-violet-600"
                          )}
                        >
                          <FileBarChartIcon className="size-3.5" />
                        </span>
                        {task[0]}
                      </td>
                      <td className="px-4">{task[1]}</td>
                      <td className="whitespace-nowrap px-4">{task[2]}</td>
                      <td className="whitespace-nowrap px-4">
                        <span
                          className={cn(
                            "flex items-center gap-1.5",
                            task[3] === "已完成"
                              ? "text-emerald-600"
                              : task[3] === "运行中"
                                ? "text-blue-600"
                                : "text-red-500"
                          )}
                        >
                          <i className="size-2 rounded-full bg-current" />
                          {task[3]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4">{task[4]}</td>
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
              title="热门 Skill"
            />
            <ol className="px-5 py-1">
              {popularSkills.map(
                ([name, description, count, Icon, iconClass], index) => (
                  <li className="flex h-[49px] items-center gap-3" key={name}>
                    <span className="w-3 text-xs text-[#6980a5]">
                      {index + 1}
                    </span>
                    <span
                      className={cn(
                        "grid size-8 place-items-center rounded-lg",
                        iconClass
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-xs font-semibold text-[#243653]">
                        {name}
                      </strong>
                      <span className="block truncate text-[10px] text-[#8090aa]">
                        {description}
                      </span>
                    </span>
                    <span className="text-xs font-medium text-[#243653]">
                      {count}
                    </span>
                  </li>
                )
              )}
            </ol>
          </article>

          <article className={cn(panelClass, "xl:col-span-3")}>
            <PanelHeader action={<ViewAll />} title="最新动态" />
            <ol className="relative px-5 py-2 before:absolute before:bottom-6 before:left-[23px] before:top-6 before:w-px before:bg-[#dce5f0]">
              {activities.map(([title, description, time, color]) => (
                <li
                  className="relative flex min-h-[48px] gap-3 pl-5"
                  key={title}
                >
                  <i
                    className={cn(
                      "absolute left-0 top-2 size-2.5 rounded-full ring-4 ring-white",
                      color
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <strong className="block text-xs font-semibold text-[#243653]">
                      {title}
                    </strong>
                    <span className="block truncate text-[10px] text-[#7587a4]">
                      {description}
                    </span>
                  </span>
                  <time className="shrink-0 pt-0.5 text-[10px] text-[#8090aa]">
                    {time}
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
