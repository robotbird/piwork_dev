import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTokenStatistics,
  defaultTokenDates,
  type TokenRow,
  tokenChange,
  tokenFilters,
} from "../../../lib/admin/token-statistics";

const filters = tokenFilters.parse({ end: "2026-10-03", start: "2026-10-01" });
const row: TokenRow = {
  chatId: "c",
  completed: 1,
  day: "2026-10-01",
  department: "Product",
  departmentId: "d",
  model: "provider / model",
  recorded: 1,
  role: "Admin / Member",
  tokens: 100,
  userId: "u",
};
test("date validation rejects invalid calendar dates and caps query ranges", () => {
  assert.equal(
    tokenFilters.safeParse({ end: "2026-03-01", start: "2026-02-30" }).success,
    false
  );
  assert.equal(
    tokenFilters.safeParse({ end: "2026-10-01", start: "2026-10-03" }).success,
    false
  );
  assert.equal(
    tokenFilters.safeParse({ end: "2026-04-04", start: "2026-01-01" }).success,
    false
  );
  assert.equal(
    tokenFilters.safeParse({ ...filters, department: "invalid" }).success,
    false
  );
  assert.deepEqual(defaultTokenDates(new Date("2026-10-03T12:00:00Z")), {
    end: "2026-10-03",
    start: "2026-09-04",
  });
});
test("totals deduplicate users/chats, preserve missing and zero, compare equal periods", () => {
  const result = buildTokenStatistics(
    [
      row,
      { ...row, day: "2026-09-30", tokens: 50 },
      { ...row, recorded: 0, tokens: null },
      { ...row, day: "2026-10-02", tokens: 0 },
      { ...row, model: "other", tokens: 100, userId: "u2" },
    ],
    filters
  );
  assert.deepEqual(result.summary, {
    average: 100,
    completed: 4,
    conversations: 1,
    recorded: 3,
    tokens: 200,
    users: 2,
  });
  assert.equal(result.changes.tokens, 300);
  assert.equal(result.roles[0].tokens, 200);
  assert.equal(result.trend.length, 3);
  const modelIndex = result.models.findIndex((m) => m.key === row.model);
  assert.equal(result.trend[1].values[modelIndex], 0);
  assert.equal(result.trend[2].values[0], null);
  assert.equal(
    buildTokenStatistics([{ ...row, recorded: 0, tokens: null }], filters)
      .summary.tokens,
    null
  );
  assert.equal(
    buildTokenStatistics([{ ...row, tokens: 0 }], filters).summary.tokens,
    0
  );
  assert.equal(buildTokenStatistics([], filters).summary.tokens, null);
  assert.equal(tokenChange(10, 0), null);
  assert.equal(tokenChange(0, 10), -100);
});
test("departments with the same name are not merged", () => {
  const result = buildTokenStatistics(
    [row, { ...row, departmentId: "other", tokens: 20 }],
    filters
  );
  assert.equal(result.departments.length, 2);
  assert.deepEqual(
    result.departments.map((r) => r.tokens),
    [100, 20]
  );
});
