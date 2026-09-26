import "./test-env";
import test from "node:test";
import postgres from "postgres";
import {
  afterSeqFilterCase,
  appendAndReplayCase,
  CASE_RUN_IDS,
  crossRunIsolationCase,
  duplicateSeqIgnoredCase,
  emptyRunCase,
} from "../runtime/run/event-store-cases";
import { PostgresEventStore } from "./runtime-event-queries";

/**
 * PostgresEventStore 集成测试（v2.0 §2.9b）：与 InMemory 封闭测试（event-store
 * .test.ts）跑同一套契约用例（Step 1 double 模式）。无 POSTGRES_URL 整体
 * skip；用例 runId 为固定 uuid（CASE_RUN_IDS），before 预插 AgentRun 行满足
 * 外键，after 删测试 chat 级联清理（项目铁律：测试数据不残留开发库）。
 */

const dbTest = process.env.POSTGRES_URL ? test : test.skip;

const USER_EMAIL = `runtime-event-pg-${Date.now()}@test.local`;
const CASE_RUN_ID_LIST = Object.values(CASE_RUN_IDS);

const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
let userId = "";

test.before(async () => {
  if (!process.env.POSTGRES_URL) {
    return;
  }
  userId = globalThis.crypto.randomUUID();
  const chatId = globalThis.crypto.randomUUID();
  await sql`INSERT INTO "User" ("id", "email") VALUES (${userId}, ${USER_EMAIL})`;
  await sql`INSERT INTO "Chat" ("id", "title", "userId", "createdAt")
    VALUES (${chatId}, ${"runtime-event-pg"}, ${userId}, ${new Date()})`;
  for (const runId of CASE_RUN_ID_LIST) {
    // biome-ignore lint/performance/noAwaitInLoops: before 钩子逐条播种外键行，顺序执行即语义
    await sql`INSERT INTO "AgentRun" ("id", "chatId", "userId")
      VALUES (${runId}, ${chatId}, ${userId})`;
  }
});

test.after(async () => {
  if (!process.env.POSTGRES_URL) {
    return;
  }
  // Chat 级联删除 AgentRun → RuntimeEvent/RuntimeLease，再删测试账号
  await sql`DELETE FROM "Chat"
    WHERE "userId" IN (SELECT "id" FROM "User" WHERE "email" = ${USER_EMAIL})`;
  await sql`DELETE FROM "User" WHERE "email" = ${USER_EMAIL}`;
  await sql.end();
});

dbTest("PG：append 后按 seq 升序重放", async () => {
  await appendAndReplayCase(new PostgresEventStore());
});

dbTest("PG：重复 (runId, seq) 静默忽略（唯一索引幂等）", async () => {
  await duplicateSeqIgnoredCase(new PostgresEventStore());
});

dbTest("PG：afterSeq 严格大于过滤", async () => {
  await afterSeqFilterCase(new PostgresEventStore());
});

dbTest("PG：无事件 run latestSeq=0", async () => {
  await emptyRunCase(new PostgresEventStore());
});

dbTest("PG：跨 run 隔离", async () => {
  await crossRunIsolationCase(new PostgresEventStore());
});
