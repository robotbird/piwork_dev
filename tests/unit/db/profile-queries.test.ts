import "../../support/db-env";
import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import {
  getProfile,
  updateProfileImage,
  updateProfileName,
  updateProfilePassword,
} from "../../../lib/db/profile-queries";

const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });

test("profile queries isolate accounts, task statistics and yearly activity", async () => {
  const ids = [crypto.randomUUID(), crypto.randomUUID()];
  const departmentId = crypto.randomUUID();
  const roleId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const roleName = `Profile role ${roleId}`;
  const chatIds = [crypto.randomUUID(), crypto.randomUUID()];
  try {
    await Promise.all(
      ids.map(async (_, i) => {
        await sql`insert into "User" (id, email, password, name) values (${ids[i]}, ${`profile-${ids[i]}@test.local`}, 'old-hash', ${`User ${i}`})`;
        await sql`insert into "Chat" (id, "userId", title, "createdAt", visibility) values (${chatIds[i]}, ${ids[i]}, ${`Task ${i}`}, now(), 'private')`;
        await sql`insert into "AgentRun" ("chatId", "userId", status, "startedAt", "endedAt") values (${chatIds[i]}, ${ids[i]}, 'settled', now() - interval '2 minutes', now())`;
      })
    );
    await sql`insert into "Department" (id, name) values (${departmentId}, 'Profile Department')`;
    await sql`insert into "Member" (id, "userId", "departmentId", role) values (${memberId}, ${ids[0]}, ${departmentId}, 'admin')`;
    await sql`insert into "Role" (id, name) values (${roleId}, ${roleName})`;
    await sql`insert into "MemberRole" ("memberId", "roleId") values (${memberId}, ${roleId})`;
    await Promise.all(
      ids.map(async (userId, index) => {
        const [run] =
          await sql`select id from "AgentRun" where "userId" = ${userId}`;
        await sql`insert into "RuntimeEvent" ("runId", seq, type, data) values (${run.id}, 1, 'message.completed', ${sql.json({ usage: { cacheRead: 0, cacheWrite: 0, input: 1, output: 2, totalTokens: index === 0 ? 21_210_000 : 999 } })})`;
      })
    );
    const profile = await getProfile(ids[0]);
    assert.equal(profile?.account.department, "Profile Department");
    assert.equal(profile?.account.role, "admin");
    assert.deepEqual(profile?.account.roles, [roleName]);
    const other = await getProfile(ids[1]);
    assert.equal(other?.account.department, null);
    assert.equal(other?.account.role, null);
    assert.deepEqual(other?.account.roles, []);

    assert.equal(profile?.account.name, "User 0");
    assert.equal(profile?.stats.total, 1);
    assert.equal(profile?.stats.totalTokens, 21_210_000);
    assert.equal(profile?.activity.at(-1)?.tokens, 21_210_000);
    assert.equal(profile?.stats.succeeded, 1);
    assert.equal(profile?.stats.longestSeconds, 120);
    assert.equal(
      profile?.activity.reduce((sum, day) => sum + day.count, 0),
      1
    );
    assert.ok((profile?.activity.length ?? 0) >= 365);
    assert.equal(profile?.activity.at(-1)?.count, 1);
    await sql`insert into "AgentRun" ("chatId", "userId", status, "createdAt") values (${chatIds[0]}, ${ids[0]}, 'settled', current_date - interval '1 day'), (${chatIds[0]}, ${ids[0]}, 'settled', current_date - interval '2 years')`;
    const history = await getProfile(ids[0]);
    assert.equal(
      history?.activity.reduce((sum, day) => sum + day.count, 0),
      2
    );
    assert.equal(history?.activity.at(-2)?.count, 1);
    assert.equal(history?.activity.at(-3)?.count, 0);
    assert.equal(history?.activity.at(-2)?.tokens, null);
    assert.equal(history?.activity.at(-3)?.tokens, 0);

    assert.equal("password" in (profile?.account ?? {}), false);
    assert.equal(
      await updateProfileImage(ids[0], "/api/library/test-avatar?preview=1"),
      true
    );
    assert.equal(
      (await getProfile(ids[0]))?.account.image,
      "/api/library/test-avatar?preview=1"
    );
    assert.equal((await getProfile(ids[1]))?.account.image, null);
    assert.equal(await updateProfileImage(ids[0], null), true);
    assert.equal((await getProfile(ids[0]))?.account.image, null);
    await updateProfileName(ids[0], "Updated");
    assert.equal((await getProfile(ids[0]))?.account.name, "Updated");
    assert.equal((await getProfile(ids[1]))?.account.name, "User 1");
    assert.equal(
      await updateProfilePassword(ids[0], "wrong-hash", "new-hash"),
      false
    );
    assert.equal(
      await updateProfilePassword(ids[0], "old-hash", "new-hash"),
      true
    );
    assert.equal(
      await updateProfilePassword(ids[0], "old-hash", "other-hash"),
      false
    );
    const [untouched] =
      await sql`select password from "User" where id = ${ids[1]}`;
    assert.equal(untouched.password, "old-hash");
    assert.equal(await getProfile(crypto.randomUUID()), null);
  } finally {
    await sql`delete from "AgentRun" where "userId" = any(${ids})`;
    await sql`delete from "Chat" where id = any(${chatIds})`;
    await sql`delete from "User" where id = any(${ids})`;
    await sql`delete from "Department" where id = ${departmentId}`;
    await sql`delete from "Role" where id = ${roleId}`;
    await sql.end();
  }
});
