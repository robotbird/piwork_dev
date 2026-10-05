import "../../support/db-env";
import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { resolveRoleModelAccess } from "../../../lib/admin/role-model-policy";
import { getDb } from "../../../lib/db/client";
import {
  getRoleTokenUsage,
  getUserRolePolicies,
  updateRolePolicy,
} from "../../../lib/db/role-policy-queries";

test("role policies persist, scope usage, reset, reject disabled accounts", {
  skip: !process.env.POSTGRES_URL,
}, async () => {
  const db = getDb();
  const userId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const roleIds = [crypto.randomUUID(), crypto.randomUUID()];
  const chatId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  try {
    await db.execute(
      sql`insert into "User" (id, email) values (${userId}, ${`${userId}@test.local`})`
    );
    await db.execute(
      sql`insert into "Member" (id, "userId") values (${memberId}, ${userId})`
    );
    await db.execute(
      sql`insert into "Role" (id, name) values (${roleIds[0]}, ${roleIds[0]}), (${roleIds[1]}, ${roleIds[1]})`
    );
    await db.execute(
      sql`insert into "MemberRole" ("memberId", "roleId") values (${memberId}, ${roleIds[0]}), (${memberId}, ${roleIds[1]})`
    );
    const modelPolicy = {
      allowSwitch: false,
      defaultModelId: "p/a",
      enabledModelIds: ["p/a", "p/b"],
    };
    await updateRolePolicy(roleIds[0], {
      modelPolicy,
      tokenPolicy: { action: "block", daily: 100, monthly: 1000, perRun: 50 },
    });
    const roles = await getUserRolePolicies(userId);
    assert.deepEqual(
      roles.find((role) => role.id === roleIds[0])?.modelPolicy,
      modelPolicy
    );
    assert.deepEqual(
      resolveRoleModelAccess(
        roles.flatMap((role) => (role.modelPolicy ? [role.modelPolicy] : [])),
        ["p/a", "p/b"],
        "p/b"
      ).modelIds,
      ["p/a"]
    );
    await db.execute(
      sql`insert into "Chat" (id, "userId", title, "createdAt") values (${chatId}, ${userId}, 'role policies', now())`
    );
    await db.execute(
      sql`insert into "AgentRun" (id, "chatId", "userId", backend, status) values (${runId}, ${chatId}, ${userId}, 'in_process', 'settled')`
    );
    await db.execute(sql`insert into "RuntimeEvent" ("runId", seq, type, "createdAt", data) values
      (${runId}, 1, 'message.completed', now(), '{"usage":{"totalTokens":20,"input":10,"output":10,"cacheRead":99}}'::json),
      (${runId}, 2, 'message.completed', now(), '{"usage":{"totalTokens":0}}'::json),
      (${runId}, 3, 'message.completed', now(), '{}'::json),
      (${runId}, 4, 'tool.completed', now(), '{"usage":{"totalTokens":999}}'::json),
      (${runId}, 5, 'message.completed', date_trunc('month',current_date)-interval '1 day', '{"usage":{"totalTokens":7}}'::json)`);
    const usage = await getRoleTokenUsage(roleIds[0], runId);
    assert.deepEqual(usage, { daily: 20, missing: 1, monthly: 20, perRun: 27 });
    assert.equal((await getRoleTokenUsage(crypto.randomUUID())).daily, 0);
    await updateRolePolicy(roleIds[0], {
      modelPolicy: null,
      tokenPolicy: null,
    });
    assert.equal(
      (await getUserRolePolicies(userId)).find((role) => role.id === roleIds[0])
        ?.modelPolicy,
      null
    );
    await db.execute(
      sql`update "Member" set status='disabled' where id=${memberId}`
    );
    await assert.rejects(getUserRolePolicies(userId), /not enabled/);
  } finally {
    await db.execute(sql`delete from "Chat" where id=${chatId}`);
    await db.execute(sql`delete from "User" where id=${userId}`);
    await db.execute(
      sql`delete from "Role" where id in (${roleIds[0]}, ${roleIds[1]})`
    );
  }
});
