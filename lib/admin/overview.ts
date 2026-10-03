import "server-only";

import {
  getActiveUserCounts,
  getModelProviderHealth,
  getResourceCounts,
  getRunBackendDistribution,
  getRunDailyTrend,
  getRunStatusCounts,
  getTaskVolume,
  listRecentActivities,
  listRecentRuns,
  listRecentSkills,
  type OverviewActivityType,
  type OverviewModelProviderHealth,
  type OverviewTrendPoint,
  pingDatabase,
} from "@/lib/db/overview-queries";

const TREND_DAYS = 30;
const RECENT_RUN_LIMIT = 10;
const TOP_SKILL_LIMIT = 5;
const ACTIVITY_LIMIT = 8;

export type OverviewServiceStatus =
  | "degraded"
  | "disabled"
  | "error"
  | "operational"
  | "unknown";

export type OverviewService = {
  key: "database" | "model_providers" | "sandbox" | "scheduler";
  status: OverviewServiceStatus;
};

export type AdminOverview = {
  activities: {
    at: string;
    title: string;
    type: OverviewActivityType;
  }[];
  distribution: { backend: string; count: number }[];
  /** 生成时刻（ISO，服务器时钟） */
  generatedAt: string;
  metrics: {
    activeUsers: {
      changePct: number | null;
      current: number;
      previous: number;
    };
    skills: { enabled: number; total: number };
    successRate: {
      aborted: number;
      failed: number;
      /** 近 30 天成功率（%）：settled / (settled + failed + aborted) */
      rate: number | null;
      /** 上一个 30 天窗口成功率（%），供前端自行计算百分点差 */
      previousRate: number | null;
      settled: number;
    };
    tasks: {
      changePct: number | null;
      last30Days: number;
      previous30Days: number;
      total: number;
    };
    tools: { enabled: number; total: number };
  };
  recentRuns: {
    backend: string;
    chatId: string;
    chatTitle: string;
    createdAt: string;
    durationMs: number | null;
    runId: string;
    status: string;
    userName: string | null;
  }[];
  services: OverviewService[];
  skills: {
    description: string;
    displayName: string;
    enabled: boolean;
    name: string;
    updatedAt: string;
    version: string;
  }[];
  trend: OverviewTrendPoint[];
};

/** 相对变化（%），previous 为 0 时无法定义，返回 null */
export function computeChangePct(
  current: number,
  previous: number
): number | null {
  if (previous === 0) {
    return null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function toRate(counts: {
  aborted: number;
  failed: number;
  settled: number;
}): number | null {
  const terminal = counts.settled + counts.failed + counts.aborted;
  if (terminal === 0) {
    return null;
  }
  return Math.round((counts.settled / terminal) * 1000) / 10;
}

/** 启用插件的聚合健康：无启用插件或健康未知 → unknown */
export function aggregateProviderHealth(
  health: OverviewModelProviderHealth
): OverviewServiceStatus {
  if (health.enabled === 0) {
    return "unknown";
  }
  if (health.failed > 0) {
    return "error";
  }
  if (health.degraded > 0) {
    return "degraded";
  }
  return health.healthy === health.enabled ? "operational" : "unknown";
}

/**
 * 组装 /admin 概览 payload。所有查询并发执行；任一失败即整体失败
 * （路由层返回 500），避免给出半真半假的概览。
 */
export async function getAdminOverview(): Promise<AdminOverview> {
  const [
    volume,
    lastWindow,
    previousWindow,
    activeUsers,
    resources,
    trend,
    distribution,
    recentRuns,
    skills,
    activities,
    providerHealth,
    databaseUp,
  ] = await Promise.all([
    getTaskVolume(),
    getRunStatusCounts("last30Days"),
    getRunStatusCounts("previous30Days"),
    getActiveUserCounts(),
    getResourceCounts(),
    getRunDailyTrend(TREND_DAYS),
    getRunBackendDistribution(),
    listRecentRuns(RECENT_RUN_LIMIT),
    listRecentSkills(TOP_SKILL_LIMIT),
    listRecentActivities(ACTIVITY_LIMIT),
    getModelProviderHealth(),
    pingDatabase(),
  ]);

  const services: OverviewService[] = [
    { key: "database", status: databaseUp ? "operational" : "error" },
    { key: "model_providers", status: aggregateProviderHealth(providerHealth) },
    {
      key: "scheduler",
      status:
        process.env.SCHEDULED_TASKS_ENABLED === "true"
          ? "operational"
          : "disabled",
    },
    {
      key: "sandbox",
      // 只反映装配配置；实例实时状态以 /admin/sandboxes 的 Provider 核验为准
      status: process.env.PIWORK_SANDBOX_PROVIDER ? "operational" : "disabled",
    },
  ];

  return {
    activities: activities.map((item) => ({
      at: item.at.toISOString(),
      title: item.title,
      type: item.type,
    })),
    distribution,
    generatedAt: new Date().toISOString(),
    metrics: {
      activeUsers: {
        changePct: computeChangePct(
          activeUsers.last30Days,
          activeUsers.previous30Days
        ),
        current: activeUsers.last30Days,
        previous: activeUsers.previous30Days,
      },
      skills: resources.skills,
      successRate: {
        aborted: lastWindow.aborted,
        failed: lastWindow.failed,
        previousRate: toRate(previousWindow),
        rate: toRate(lastWindow),
        settled: lastWindow.settled,
      },
      tasks: {
        changePct: computeChangePct(volume.last30Days, volume.previous30Days),
        last30Days: volume.last30Days,
        previous30Days: volume.previous30Days,
        total: volume.total,
      },
      tools: resources.tools,
    },
    recentRuns: recentRuns.map((run) => ({
      backend: run.backend,
      chatId: run.chatId,
      chatTitle: run.chatTitle,
      createdAt: run.createdAt.toISOString(),
      durationMs: run.durationMs,
      runId: run.runId,
      status: run.status,
      userName: run.userName,
    })),
    services,
    skills: skills.map((item) => ({
      description: item.description,
      displayName: item.displayName,
      enabled: item.enabled,
      name: item.name,
      updatedAt: item.updatedAt.toISOString(),
      version: item.version,
    })),
    trend,
  };
}
