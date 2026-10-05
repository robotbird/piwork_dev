import "../../support/db-env";
import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import {
  acquireLease,
  createAgentRun,
  failOrphanedRuns,
  failStaleRuns,
  getActiveRunByChatId,
  markRunStatus,
  releaseLease,
  renewLeases,
} from "../../../lib/db/agent-run-queries";

/**
 * AgentRun + RuntimeLease 集成测试（v2.0 §2.9b）：markRunStatus 条件更新、
 * lease 互斥与心跳、僵尸清理两条路径（心跳过期 / 单进程孤儿）。无
 * POSTGRES_URL 整体 skip；每个用例独立 chat（互不串扰），after 级联清理。
 */

const dbTest = process.env.POSTGRES_URL ? test : test.skip;

const USER_EMAIL = `runtime-agent-run-pg-${Date.now()}@test.local`;
const NON_TERMINAL = ["queued", "starting", "running", "waiting_user"] as const;

const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
let userId = "";

test.before(async () => {
  if (!process.env.POSTGRES_URL) {
    return;
  }
  userId = globalThis.crypto.randomUUID();
  await sql`INSERT INTO "User" ("id", "email") VALUES (${userId}, ${USER_EMAIL})`;
});

test.after(async () => {
  if (!process.env.POSTGRES_URL) {
    return;
  }
  await sql`DELETE FROM "Chat"
    WHERE "userId" IN (SELECT "id" FROM "User" WHERE "email" = ${USER_EMAIL})`;
  await sql`DELETE FROM "User" WHERE "email" = ${USER_EMAIL}`;
  await sql.end();
});

/** 独立 chat + 一个 queued run；chat 随 after 级联清理 */
async function makeRun(): Promise<{ chatId: string; runId: string }> {
  const chatId = globalThis.crypto.randomUUID();
  await sql`INSERT INTO "Chat" ("id", "title", "userId", "createdAt")
    VALUES (${chatId}, ${"runtime-agent-run-pg"}, ${userId}, ${new Date()})`;
  const runId = await createAgentRun({
    backend: "in_process",
    chatId,
    userId,
  });
  return { chatId, runId };
}

async function statusOf(runId: string): Promise<string | null> {
  const rows = await sql`SELECT "status" FROM "AgentRun" WHERE "id" = ${runId}`;
  return rows[0]?.status ?? null;
}

dbTest("markRunStatus：allowedFrom 生效、终态防回退并记 endedAt", async () => {
  const { runId } = await makeRun();
  assert.equal(
    await markRunStatus(runId, "running", { allowedFrom: NON_TERMINAL }),
    true
  );
  assert.equal(
    await markRunStatus(runId, "settled", { allowedFrom: ["queued"] }),
    false
  );
  assert.equal(await statusOf(runId), "running");
  assert.equal(
    await markRunStatus(runId, "settled", { allowedFrom: NON_TERMINAL }),
    true
  );
  // settled → running：allowedFrom 不含终态，被拒（防回退）
  assert.equal(
    await markRunStatus(runId, "running", { allowedFrom: NON_TERMINAL }),
    false
  );
  const rows =
    await sql`SELECT "status", "endedAt" FROM "AgentRun" WHERE "id" = ${runId}`;
  assert.equal(rows[0]?.status, "settled");
  assert.ok(rows[0]?.endedAt, "终态应记录 endedAt");
});

dbTest("markRunStatus：failed 携带 errorMessage", async () => {
  const { runId } = await makeRun();
  assert.equal(
    await markRunStatus(runId, "failed", {
      allowedFrom: NON_TERMINAL,
      errorMessage: "boom",
    }),
    true
  );
  const rows =
    await sql`SELECT "status", "errorMessage" FROM "AgentRun" WHERE "id" = ${runId}`;
  assert.equal(rows[0]?.status, "failed");
  assert.equal(rows[0]?.errorMessage, "boom");
});

dbTest("lease：acquire 互斥、release 后可再持有", async () => {
  const { runId } = await makeRun();
  assert.equal(await acquireLease(runId, "worker-1"), true);
  assert.equal(await acquireLease(runId, "worker-2"), false);
  await releaseLease(runId);
  assert.equal(await acquireLease(runId, "worker-2"), true);
  await releaseLease(runId);
});

dbTest(
  "failStaleRuns：只命中心跳过期且非终态；renew 后豁免；无 lease 不波及",
  async () => {
    const stale = await makeRun();
    const renewed = await makeRun();
    const noLease = await makeRun();
    assert.equal(await acquireLease(stale.runId, "worker-1"), true);
    assert.equal(await acquireLease(renewed.runId, "worker-1"), true);
    for (const run of [stale, renewed]) {
      // biome-ignore lint/performance/noAwaitInLoops: 测试前置逐条播种，顺序执行即语义
      await markRunStatus(run.runId, "running", { allowedFrom: NON_TERMINAL });
    }
    assert.equal(
      await markRunStatus(noLease.runId, "running", {
        allowedFrom: NON_TERMINAL,
      }),
      true
    );
    // 两个 lease 都回拨 1 小时，随后仅 renewed 续约（心跳刷新到当前）
    for (const run of [stale, renewed]) {
      // biome-ignore lint/performance/noAwaitInLoops: 测试前置逐条回拨，顺序执行即语义
      await sql`UPDATE "RuntimeLease"
      SET "heartbeatAt" = now() - interval '1 hour' WHERE "runId" = ${run.runId}`;
    }
    await renewLeases("worker-1", [renewed.runId]);

    const hit = await failStaleRuns(30_000, [
      stale.runId,
      renewed.runId,
      noLease.runId,
    ]);
    assert.ok(hit >= 1, "至少命中回拨心跳的 stale run");
    assert.equal(await statusOf(stale.runId), "failed");
    assert.equal(await statusOf(renewed.runId), "running");
    // 无 lease 的 run 不在心跳检测范围（由 failOrphanedRuns 收敛）
    assert.equal(await statusOf(noLease.runId), "running");
    // stale run 的 lease 一并清除
    const leases =
      await sql`SELECT * FROM "RuntimeLease" WHERE "runId" = ${stale.runId}`;
    assert.equal(leases.length, 0);
  }
);

dbTest("failOrphanedRuns：排除本进程 LiveRun，终态不动", async () => {
  const orphan = await makeRun();
  const live = await makeRun();
  const done = await makeRun();
  assert.equal(
    await markRunStatus(orphan.runId, "running", { allowedFrom: NON_TERMINAL }),
    true
  );
  assert.equal(
    await markRunStatus(live.runId, "running", { allowedFrom: NON_TERMINAL }),
    true
  );
  assert.equal(
    await markRunStatus(done.runId, "settled", { allowedFrom: NON_TERMINAL }),
    true
  );

  const hit = await failOrphanedRuns(
    [live.runId],
    [orphan.runId, live.runId, done.runId]
  );
  assert.equal(hit, 1);
  assert.equal(await statusOf(orphan.runId), "failed");
  assert.equal(await statusOf(live.runId), "running");
  assert.equal(await statusOf(done.runId), "settled");
});

dbTest(
  "orphan cleanup preserves leased starting runs and stays inside the requested fixture scope",
  async () => {
    const starting = await makeRun();
    const orphan = await makeRun();
    const outside = await makeRun();
    await acquireLease(starting.runId, "live-worker");
    await markRunStatus(starting.runId, "starting", {
      allowedFrom: NON_TERMINAL,
    });
    assert.equal(await failOrphanedRuns([], [starting.runId, orphan.runId]), 1);
    assert.equal(await statusOf(starting.runId), "starting");
    assert.equal(await statusOf(orphan.runId), "failed");
    assert.equal(await statusOf(outside.runId), "queued");
    assert.equal(await failOrphanedRuns([], []), 0);
    await releaseLease(starting.runId);
    await markRunStatus(starting.runId, "settled", {
      allowedFrom: NON_TERMINAL,
    });
    await markRunStatus(outside.runId, "settled", {
      allowedFrom: NON_TERMINAL,
    });
  }
);

dbTest(
  "cleanup rechecks terminal status after waiting for a row lock and only releases transitioned leases",
  async () => {
    const { runId } = await makeRun();
    await acquireLease(runId, "live-worker");
    await sql`update "RuntimeLease" set "heartbeatAt" = now() - interval '1 hour' where "runId" = ${runId}`;
    let cleanup: Promise<number> | undefined;
    try {
      await sql.begin(async (tx) => {
        await tx`select id from "AgentRun" where id = ${runId} for update`;
        cleanup = failStaleRuns(30_000, [runId]);
        const deadline = Date.now() + 5000;
        let blocked = false;
        while (Date.now() < deadline) {
          // Wait for the competing UPDATE to really reach the row lock, not a sleep-based guess.
          const [row] =
            // biome-ignore lint/performance/noAwaitInLoops: deterministic lock-race orchestration
            await tx`select exists (select 1 from pg_stat_activity a where pg_backend_pid() = any(pg_blocking_pids(a.pid))) as blocked`;
          if (row.blocked) {
            blocked = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.ok(blocked, "cleanup must be blocked on this fixture's row");
        await tx`update "AgentRun" set status = 'settled', "endedAt" = now() where id = ${runId}`;
      });
      assert.equal(await cleanup, 0);
      assert.equal(await statusOf(runId), "settled");
      const leases =
        await sql`select id from "RuntimeLease" where "runId" = ${runId}`;
      assert.equal(leases.length, 1);
      await releaseLease(runId);
    } finally {
      await cleanup?.catch(() => undefined);
    }
  }
);

dbTest("getActiveRunByChatId：仅非终态，且为最新一条", async () => {
  const { chatId, runId: seedRun } = await makeRun();
  // makeRun 自带的 run 需先落终态，避免它作为“活跃 run”干扰断言
  assert.equal(
    await markRunStatus(seedRun, "settled", { allowedFrom: NON_TERMINAL }),
    true
  );
  const first = await createAgentRun({
    backend: "in_process",
    chatId,
    userId,
  });
  await markRunStatus(first, "settled", { allowedFrom: NON_TERMINAL });
  const second = await createAgentRun({
    backend: "in_process",
    chatId,
    userId,
  });
  assert.equal((await getActiveRunByChatId(chatId))?.runId, second);
  await markRunStatus(second, "aborted", { allowedFrom: NON_TERMINAL });
  assert.equal(await getActiveRunByChatId(chatId), null);
});
