import assert from "node:assert/strict";
import test from "node:test";
import {
  conversationFilters,
  conversationText,
} from "../../../lib/admin/conversations";

test("conversation filters validate and default bounded pagination", () => {
  const defaults = conversationFilters.parse({});
  assert.equal(defaults.days, "7");
  assert.equal(defaults.pageSize, 10);
  assert.equal(
    conversationFilters.parse({ page: "2", pageSize: "20", query: " hello " })
      .query,
    "hello"
  );
  for (const input of [
    { page: 0 },
    { pageSize: 1000 },
    { project: "bad-id" },
    { status: "archived" },
    { days: "1" },
    { sort: "DROP TABLE" },
    { query: "x".repeat(201) },
  ]) {
    assert.equal(conversationFilters.safeParse(input).success, false);
  }
});

test("record projection excludes reasoning, tools, attachment URLs and malformed parts", () => {
  assert.equal(conversationText(null), "");
  assert.equal(
    conversationText([
      null,
      { text: 42, type: "text" },
      { text: "secret", type: "reasoning" },
      { output: "credential", type: "tool-result" },
      { type: "file", url: "private" },
      { text: "Hello", type: "text" },
      { text: "world", type: "text" },
    ]),
    "Hello\nworld"
  );
});
