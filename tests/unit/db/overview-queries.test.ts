import "../../support/db-env";
import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import type { OverviewTrendPoint } from "../../../lib/db/overview-queries";
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
  pingDatabase,
} from "../../../lib/db/overview-queries";

const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
const suffix = crypto.randomUUID().slice(0, 8);
const ownerName = `概览用户一-${suffix}`;
const memberName = `概览用户二-${suffix}`;
const ownerEmail = `ovw-owner-${suffix}@test.local`;
const memberEmail = `ovw-member-${suffix}@test.local`;
const skillAName = `ovw-skill-a-${suffix}`;
const skillBName = `ovw-skill-b-${suffix}`;
const toolName = `ovw-tool-${suffix}`;
const sandboxExternalId = `ovw-sandbox-${suffix}`;
const providerKey = `ovw-provider-${suffix}`;
const chatATitle = `概览聊天A-${suffix}`;
const chatBTitle = `概览聊天B-${suffix}`;
const taskPrompt = `概览定时任务提示词-${suffix}`;
const sandboxImage = "pi-runtime:ovw-test";

type Snapshot = Awaited<ReturnType<typeof snapshot>>;

let ownerId = "";
let memberId = "";
let chatAId = "";
let chatBId = "";
let runIds: string[] = [];
/** seed 前的聚合基线；before 内先快照再写数据，用例按差值断言 */
let baseline: Snapshot;

async function snapshot() {
  const [
    volume,
    last30,
    previous30,
    activeUsers,
    trend,
    distribution,
    resources,
    providerHealth,
  ] = await Promise.all([
    getTaskVolume(),
    getRunStatusCounts("last30Days"),
    getRunStatusCounts("previous30Days"),
    getActiveUserCounts(),
    getRunDailyTrend(30),
    getRunBackendDistribution(),
    getResourceCounts(),
    getModelProviderHealth(),
  ]);
  return {
    activeUsers,
    distribution,
    last30,
    previous30,
    providerHealth,
    resources,
    trend,
    volume,
  };
}

function bucketMap(points: OverviewTrendPoint[]) {
  return new Map(points.map((point) => [point.date, point]));
}

function distributionMap(rows: { backend: string; count: number }[]) {
  return new Map(rows.map((row) => [row.backend, row.count]));
}

test.before(async () => {
  baseline = await snapshot();

  const [owner] = await sql`
    insert into "User" (id, email, name)
    values (${crypto.randomUUID()}, ${ownerEmail}, ${ownerName})
    returning id`;
  const [member] = await sql`
    insert into "User" (id, email, name)
    values (${crypto.randomUUID()}, ${memberEmail}, ${memberName})
    returning id`;
  ownerId = String(owner.id);
  memberId = String(member.id);
  const [chatA] = await sql`
    insert into "Chat" (id, title, "userId", "createdAt")
    values (${crypto.randomUUID()}, ${chatATitle}, ${ownerId}, now() - interval '5 days')
    returning id`;
  const [chatB] = await sql`
    insert into "Chat" (id, title, "userId", "createdAt")
    values (${crypto.randomUUID()}, ${chatBTitle}, ${memberId}, now() - interval '5 days')
    returning id`;
  chatAId = String(chatA.id);
  chatBId = String(chatB.id);

  // AgentRun 全部回溯到其他测试不会触碰的时间（31~60 天窗口与 5 天前的
  // 自然日桶）；并发测试（agent-run-queries 等）只写 now()，今日桶不精确断言。
  const inserted = await sql`
    insert into "AgentRun" ("chatId", "userId", status, backend, "createdAt", "startedAt", "endedAt")
    values
      (${chatAId}, ${ownerId}, 'settled', 'in_process', now() - interval '5 days' + interval '3 minutes', now() - interval '5 days' + interval '1 minute', now() - interval '5 days' + interval '7 minutes'),
      (${chatBId}, ${memberId}, 'failed', 'sandbox_rpc', now() - interval '5 days', null, null),
      (${chatAId}, ${ownerId}, 'aborted', 'in_process', now() - interval '40 days' + interval '1 minute', null, null),
      (${chatAId}, ${ownerId}, 'settled', 'in_process', now() - interval '40 days', null, null),
      (${chatAId}, ${ownerId}, 'running', 'in_process', now() - interval '25 days', null, null)
    returning id`;
  runIds = inserted.map((row) => String(row.id));

  // Skill/McpServer/SandboxInstance 生产写入方使用 UTC 墙钟
  // （drizzle new Date() 或显式 UTC 连接），夹具与其保持一致。
  await sql`
    insert into "Skill" (name, "displayName", description, "relativePath", source, enabled, "updatedAt")
    values
      (${skillAName}, '概览技能A', '概览测试技能 A', '/skills/ovw-a', 'upload', true, now() at time zone 'utc'),
      (${skillBName}, '概览技能B', '概览测试技能 B', '/skills/ovw-b', 'upload', false, (now() - interval '6 minutes') at time zone 'utc')`;
  await sql`
    insert into "McpServer" (name, transport, url, "updatedAt")
    values (${toolName}, 'http', 'http://127.0.0.1:1/mcp', (now() - interval '2 minutes') at time zone 'utc')`;
  await sql`
    insert into "Member" (id, "userId", role, status, "createdAt")
    values (${crypto.randomUUID()}, ${memberId}, 'member', 'enabled', now() - interval '3 minutes')`;
  await sql`
    insert into "SandboxInstance" ("provider", "externalId", "chatId", "userId", image, status, "ttlSeconds", "expiresAt", "createdAt")
    values ('test', ${sandboxExternalId}, ${chatAId}, ${ownerId}, ${sandboxImage}, 'ready', 3600, now() + interval '1 hour', (now() - interval '4 minutes') at time zone 'utc')`;
  await sql`
    insert into "ScheduledTask" ("userId", prompt, schedule, "taskType", "createdAt")
    values (${ownerId}, ${taskPrompt}, ${sql.json({ cron: "0 9 * * *" })}, 'test', now() - interval '5 minutes')`;
  await sql`
    insert into "ModelProviderPlugin" ("providerKey", "packageId", "displayName", definition, "encryptedCredentials", "buildHash", sha256, version)
    values (${providerKey}, 'ovw-package', '概览插件', ${sql.json({})}, 'cipher', 'hash', 'sha', '1.0.0')`;
});

test.after(async () => {
  await sql`delete from "Skill" where name in (${skillAName}, ${skillBName})`;
  await sql`delete from "McpServer" where name = ${toolName}`;
  await sql`delete from "ModelProviderPlugin" where "providerKey" = ${providerKey}`;
  await sql`delete from "Chat" where id in (${chatAId}, ${chatBId})`;
  // Member / ScheduledTask 随用户级联清理，SandboxInstance 随聊天级联清理
  await sql`delete from "User" where id in (${ownerId}, ${memberId})`;
  await sql.end();
});

test("volume, status windows and active users follow the 30-day windows", async () => {
  const after = await snapshot();

  // 31~60 天窗口没有其他写入者（其他测试只用 now()），差值可精确断言：
  // 40 天前的 settled + aborted 两个 run，活跃用户只有 owner。
  assert.equal(after.volume.previous30Days - baseline.volume.previous30Days, 2);
  assert.equal(after.previous30.settled - baseline.previous30.settled, 1);
  assert.equal(after.previous30.failed - baseline.previous30.failed, 0);
  assert.equal(after.previous30.aborted - baseline.previous30.aborted, 1);
  assert.equal(
    after.activeUsers.previous30Days - baseline.activeUsers.previous30Days,
    1
  );

  // 近 30 天窗口与总量有并发写入者（now()），只断言下界：
  // 近 30 天 = 5 天前两个 + 25 天前一个 running。
  assert.ok(after.volume.total - baseline.volume.total >= 5);
  assert.ok(after.volume.last30Days - baseline.volume.last30Days >= 3);
  assert.ok(after.last30.settled - baseline.last30.settled >= 1);
  assert.ok(after.last30.failed - baseline.last30.failed >= 1);
  // 本测试不向近 30 天窗口写 aborted；其他测试也只产生 failed/settled
  assert.equal(after.last30.aborted - baseline.last30.aborted, 0);
  assert.ok(
    after.activeUsers.last30Days - baseline.activeUsers.last30Days >= 2
  );
});

test("trend covers exactly 30 ascending days with backdated buckets", async () => {
  const trend = await getRunDailyTrend(30);
  assert.equal(trend.length, 30);
  const dates = trend.map((point) => point.date);
  assert.deepEqual([...dates].sort(), dates);

  const todayRows = await sql`select to_char(now(), 'YYYY-MM-DD') as label`;
  assert.equal(dates.at(-1), String(todayRows[0].label));

  // 库里可能有真实的近期 run，因此与 seed 前的基线按自然日做差值断言：
  // 5 天前桶的增量只有本测试的 settled + failed 各一条。
  const day5Rows = await sql`
    select to_char(now() - interval '5 days', 'YYYY-MM-DD') as label`;
  const day5 = String(day5Rows[0].label);
  const before = bucketMap(baseline.trend).get(day5);
  const after = bucketMap(trend).get(day5);
  assert.ok(after);
  assert.equal(after.succeeded - (before?.succeeded ?? 0), 1);
  assert.equal(after.failed - (before?.failed ?? 0), 1);
  assert.equal(after.aborted - (before?.aborted ?? 0), 0);

  // 40 天前超出 30 天窗口，不应出现在趋势里
  const day40Rows = await sql`
    select to_char(now() - interval '40 days', 'YYYY-MM-DD') as label`;
  assert.equal(bucketMap(trend).has(String(day40Rows[0].label)), false);
});

test("trend clamps the requested day range", async () => {
  const trend = await getRunDailyTrend(400);
  assert.equal(trend.length, 90);
  const single = await getRunDailyTrend(0);
  assert.equal(single.length, 1);
});

test("distribution counts by backend", async () => {
  const after = distributionMap(await getRunBackendDistribution());
  const before = distributionMap(baseline.distribution);
  // sandbox_rpc 增量只来自本测试（其他测试只写 in_process）
  assert.equal(
    (after.get("sandbox_rpc") ?? 0) - (before.get("sandbox_rpc") ?? 0),
    1
  );
  assert.ok(
    (after.get("in_process") ?? 0) - (before.get("in_process") ?? 0) >= 4
  );
});

test("recent runs join chat title, user name and duration", async () => {
  const runs = await listRecentRuns(200);
  const mine = runs.filter((run) => runIds.includes(run.runId));
  assert.equal(mine.length, 5);

  const settled = mine.find(
    (run) => run.status === "settled" && run.durationMs !== null
  );
  assert.ok(settled);
  assert.equal(settled.chatTitle, chatATitle);
  assert.equal(settled.userName, ownerName);
  assert.equal(settled.durationMs, 360_000);
  assert.equal(settled.backend, "in_process");

  const failed = mine.find((run) => run.backend === "sandbox_rpc");
  assert.ok(failed);
  assert.equal(failed.chatTitle, chatBTitle);
  assert.equal(failed.userName, memberName);
  assert.equal(failed.durationMs, null);
  assert.equal(failed.startedAt, null);

  // 列表按 createdAt 全局倒序；本测试最新的 run 必须排在更早的 run 之前
  const newest = runs.findIndex((run) => run.runId === runIds[0]);
  const older = runs.findIndex((run) => run.runId === runIds[1]);
  assert.ok(newest >= 0 && older >= 0);
  assert.ok(newest < older);
});

test("recent skills order by updatedAt with resource counts", async () => {
  const skills = await listRecentSkills(200);
  const a = skills.find((item) => item.name === skillAName);
  const b = skills.find((item) => item.name === skillBName);
  assert.ok(a && b);
  assert.equal(a.displayName, "概览技能A");
  assert.equal(a.enabled, true);
  assert.equal(a.source, "upload");
  assert.ok(skills.indexOf(a) < skills.indexOf(b));

  const after = await snapshot();
  assert.equal(
    after.resources.skills.total - baseline.resources.skills.total,
    2
  );
  assert.equal(
    after.resources.skills.enabled - baseline.resources.skills.enabled,
    1
  );
  assert.equal(after.resources.tools.total - baseline.resources.tools.total, 1);
  assert.equal(
    after.resources.tools.enabled - baseline.resources.tools.enabled,
    1
  );
});

test("activities merge all sources ordered by time desc", async () => {
  const activities = await listRecentActivities(200);
  const expected = [
    { title: "概览技能A", type: "skill" },
    { title: toolName, type: "tool" },
    { title: memberName, type: "member" },
    { title: sandboxImage, type: "sandbox" },
    { title: taskPrompt, type: "scheduled_task" },
  ];
  let cursor = -1;
  for (const item of expected) {
    const index = activities.findIndex(
      (activity) => activity.title === item.title && activity.type === item.type
    );
    assert.ok(index > cursor, `activity ${item.title} out of order`);
    cursor = index;
  }
});

test("model provider health and database ping", async () => {
  const after = await snapshot();
  assert.equal(
    after.providerHealth.enabled - baseline.providerHealth.enabled,
    1
  );
  assert.equal(
    after.providerHealth.healthy - baseline.providerHealth.healthy,
    1
  );
  assert.equal(await pingDatabase(), true);
});
