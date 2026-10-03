import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * Inference Proxy 的 AgentRun 级短期窄权限 token（spec §6 Phase 4，v2.0
 * §7.2 MVP：按 AgentRun 签发、随 run 过期、只授权该 run 的模型集合）。
 *
 * 形态：不透明随机串（32B），服务端只存 sha256 哈希——审计与日志永远见
 * 不到 token 明文。不用 JWT：控制面单实例（与 MVP 常驻 Node 约束一致），
 * 可撤销性比无状态重要；进程重启 = 全部 token 失效，与 run 生命周期
 * fail-closed 语义一致（LiveRun 丢失 → failZombieRuns）。
 *
 * 失效通道（双保险）：
 * - 主动撤销：run 关闭时 revokeRun（backend close 钩子调用）；
 * - 滑动过期：每次成功使用续期 ttlMs，崩溃漏撤的 token 最长闲置 ttlMs
 *   后自然失效（默认 30 分钟——一次模型请求间隔远小于此值）。
 */

export type RunModelGrant = {
  /** models.json provider key（= RuntimeSpec.model.provider，如 "deepseek"） */
  provider: string;
  /** 模型裸 id（pi-messages wire 只携带 model.id，无 provider 前缀） */
  model: string;
};

export type RunTokenGrant = {
  /** 沙箱 run 标识（SandboxSpec.runId，审计关联） */
  runId: string;
  chatId: string;
  grants: readonly RunModelGrant[];
};

type StoredGrant = RunTokenGrant & {
  tokenHash: string;
  expiresAt: number;
  ttlMs: number;
  revoked: boolean;
};

export const DEFAULT_RUN_TOKEN_TTL_MS = 30 * 60_000;

export class RunTokenRegistry {
  private readonly byHash = new Map<string, StoredGrant>();
  private readonly runIds = new Map<string, Set<string>>();
  private readonly now: () => number;
  private readonly tokenBytes: number;
  private readonly defaultTtlMs: number;

  constructor(options?: {
    now?: () => number;
    tokenBytes?: number;
    defaultTtlMs?: number;
  }) {
    this.now = options?.now ?? Date.now;
    this.tokenBytes = options?.tokenBytes ?? 32;
    this.defaultTtlMs = options?.defaultTtlMs ?? DEFAULT_RUN_TOKEN_TTL_MS;
  }

  mint(request: {
    runId: string;
    chatId: string;
    grants: readonly RunModelGrant[];
    ttlMs?: number;
  }): { token: string; grant: RunTokenGrant } {
    if (request.grants.length === 0) {
      throw new Error("inference-proxy:token:no-grants（run 未授权任何模型）");
    }
    const ttlMs = request.ttlMs ?? this.defaultTtlMs;
    const token = randomBytes(this.tokenBytes).toString("hex");
    const stored: StoredGrant = {
      ...request,
      expiresAt: this.now() + ttlMs,
      grants: [...request.grants],
      revoked: false,
      tokenHash: hashToken(token),
      ttlMs,
    };
    this.byHash.set(stored.tokenHash, stored);
    let hashes = this.runIds.get(request.runId);
    if (!hashes) {
      hashes = new Set();
      this.runIds.set(request.runId, hashes);
    }
    hashes.add(stored.tokenHash);
    return {
      grant: {
        chatId: request.chatId,
        grants: stored.grants,
        runId: request.runId,
      },
      token,
    };
  }

  /** 校验并滑动续期；失败返回 null（调用方不得区分失败原因——防侧信道） */
  validate(token: string): RunTokenGrant | null {
    const stored = this.byHash.get(hashToken(token));
    if (!stored || stored.revoked || stored.expiresAt <= this.now()) {
      return null;
    }
    stored.expiresAt = this.now() + stored.ttlMs;
    return {
      chatId: stored.chatId,
      grants: stored.grants,
      runId: stored.runId,
    };
  }

  /** run 关闭/失败时撤销该 run 的全部 token（幂等） */
  revokeRun(runId: string): void {
    const hashes = this.runIds.get(runId);
    if (!hashes) {
      return;
    }
    for (const hash of hashes) {
      const stored = this.byHash.get(hash);
      if (stored) {
        stored.revoked = true;
        this.byHash.delete(hash);
      }
    }
    this.runIds.delete(runId);
  }

  /** 供测试与监控观察规模；不含任何 token 材料 */
  get size(): number {
    return this.byHash.size;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
