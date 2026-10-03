import "server-only";

import {
  findReusableSandboxExternalId,
  markSandboxDestroyed,
  markSandboxRenewed,
  markSandboxStatus,
  registerSandboxAcquired,
} from "@/lib/db/sandbox-queries";
import type {
  SandboxProviderName,
  SandboxReleasePolicy,
  SandboxSpec,
} from "./index";

/**
 * SandboxRegistry：provider 生命周期 → SandboxInstance 表（管理页数据源，
 * opensandbox-integration-spec.md §6 管理功能）。以接口形态注入
 * LeasingSandboxProvider，测试用内存实现（tests/support/sandbox/），
 * 生产用 dbSandboxRegistry（Postgres）。
 */
export interface SandboxRegistry {
  /** acquire/attach 成功后登记（upsert：chat 复用下更新 lastRunId 与到期） */
  acquired: (
    provider: SandboxProviderName,
    spec: SandboxSpec,
    externalId: string
  ) => Promise<void>;
  /** release/destroy 后标记终态（kill→destroyed；pause→paused；keep→不变） */
  released: (
    provider: SandboxProviderName,
    externalId: string,
    policy: SandboxReleasePolicy
  ) => Promise<void>;
  /** 续期成功后平移 expiresAt */
  renewed: (
    provider: SandboxProviderName,
    externalId: string,
    ttlSeconds: number
  ) => Promise<void>;
  /** chat 级复用查询：ready 且未过期的同 chat 同镜像沙箱 */
  reusableExternalId: (
    provider: SandboxProviderName,
    spec: SandboxSpec
  ) => Promise<string | null>;
  /** attach 失败等场景：记录沙箱已不可用 */
  unavailable: (
    provider: SandboxProviderName,
    externalId: string
  ) => Promise<void>;
}

export const dbSandboxRegistry: SandboxRegistry = {
  async acquired(provider, spec, externalId) {
    await registerSandboxAcquired({
      chatId: spec.chatId,
      externalId,
      image: spec.image,
      provider,
      runId: spec.runId,
      runtimeConfig: {
        egress: spec.egress,
        resource: spec.resource,
        workspaceRoot: "/workspace",
      },
      status: "ready",
      ttlSeconds: spec.ttlSeconds,
      userId: spec.userId,
    });
  },
  async released(provider, externalId, policy) {
    if (policy === "kill") {
      await markSandboxDestroyed(provider, externalId);
    } else if (policy === "pause") {
      await markSandboxStatus(provider, externalId, "paused");
    }
  },
  async renewed(provider, externalId, ttlSeconds) {
    await markSandboxRenewed(provider, externalId, ttlSeconds);
  },
  reusableExternalId(provider, spec) {
    return findReusableSandboxExternalId({
      chatId: spec.chatId,
      image: spec.image,
      provider,
    });
  },
  async unavailable(provider, externalId) {
    await markSandboxDestroyed(provider, externalId);
  },
};
