import "../../support/db-env";
import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { tokenFilters } from "../../../lib/admin/token-statistics";
import { createAgentRun } from "../../../lib/db/agent-run-queries";
import { getTokenStatistics } from "../../../lib/db/token-statistics-queries";

test("token query scopes departments, compares event dates and counts multiple roles once", {
  skip: !process.env.POSTGRES_URL,
}, async () => {
  const db = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
  const user = crypto.randomUUID();
  const chat = crypto.randomUUID();
  const department = crypto.randomUUID();
  const member = crypto.randomUUID();
  const roles = [crypto.randomUUID(), crypto.randomUUID()];
  try {
    await db`insert into "User" (id, email) values (${user}, ${`${user}@test.local`})`;
    await db`insert into "Department" (id, name) values (${department}, ${department})`;
    await db`insert into "Member" (id, "userId", "departmentId") values (${member}, ${user}, ${department})`;
    await db`insert into "Role" (id, name) values (${roles[0]}, ${roles[0]}), (${roles[1]}, ${roles[1]})`;
    await db`insert into "MemberRole" ("memberId", "roleId") values (${member}, ${roles[0]}), (${member}, ${roles[1]})`;
    await db`insert into "Chat" (id, "userId", title, "createdAt") values (${chat}, ${user}, 'Token fixture', now())`;
    const run = {
      id: await createAgentRun({
        backend: "in_process",
        chatId: chat,
        requestedModel: {
          id: "request-alias",
          name: "Alias",
          provider: "fixture",
        },
        userId: user,
      }),
    };
    await db`insert into "RuntimeEvent" ("runId", seq, type, "createdAt", data) values
      (${run.id}, 1, 'message.completed', '2026-10-01', '{"usage":{"totalTokens":100},"model":{"provider":"fixture","id":"alias","responseModel":"actual"}}'::json),
      (${run.id}, 2, 'message.completed', '2026-09-30', '{"usage":{"totalTokens":50}}'::json),
      (${run.id}, 3, 'message.completed', '2026-10-01', '{}'::json),
      (${run.id}, 4, 'message.completed', '2026-10-02', '{"usage":{"totalTokens":999}}'::json),
      (${run.id}, 5, 'tool.completed', '2026-10-01', '{"usage":{"totalTokens":999}}'::json)`;
    const result = await getTokenStatistics(
      tokenFilters.parse({ department, end: "2026-10-01", start: "2026-10-01" })
    );
    assert.equal(result.summary.tokens, 100);
    assert.equal(result.summary.completed, 2);
    assert.equal(result.summary.recorded, 1);
    assert.equal(result.summary.users, 1);
    assert.equal(result.summary.conversations, 1);
    assert.equal(result.changes.tokens, 100);
    assert.equal(result.roles.length, 1);
    assert.equal(result.roles[0].tokens, 100);
    assert.ok(result.models.some((m) => m.key === "fixture / actual"));
    assert.ok(
      result.models.some(
        (m) => m.key === "fixture / request-alias" && m.tokens === null
      )
    );
    const empty = await getTokenStatistics(
      tokenFilters.parse({ ...result.filters, department: crypto.randomUUID() })
    );
    assert.equal(empty.summary.tokens, null);
  } finally {
    await db`delete from "Chat" where id = ${chat}`;
    await db`delete from "User" where id = ${user}`;
    await db`delete from "Role" where id in (${roles[0]}, ${roles[1]})`;
    await db`delete from "Department" where id = ${department}`;
    await db.end();
  }
});
