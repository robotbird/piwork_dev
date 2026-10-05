import "../../support/db-env";
import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { getDb } from "../../../lib/db/client";
import { getUserById } from "../../../lib/db/queries";

test("DB factory reuses pools and isolates UTC and connection URLs", () => {
  const db = getDb();
  assert.equal(getDb(), db);
  assert.equal(getDb("default"), db);
  assert.equal(db.$client.options.max, 5);
  assert.equal(db.$client.options.idle_timeout, 20);
  const utc = getDb("UTC");
  assert.notEqual(utc, db);
  assert.equal(getDb("UTC"), utc);
  assert.equal(utc.$client.options.max, 2);
  assert.equal(utc.$client.options.connection.TimeZone, "UTC");
  const original = process.env.POSTGRES_URL;
  try {
    const isolated = new URL(original ?? "postgres://localhost/piwork");
    isolated.searchParams.set("application_name", "piwork-pool-isolation-test");
    process.env.POSTGRES_URL = isolated.toString();
    const separate = getDb();
    assert.notEqual(separate, db);
    assert.equal(getDb(), separate);
  } finally {
    if (original === undefined) {
      delete process.env.POSTGRES_URL;
    } else {
      process.env.POSTGRES_URL = original;
    }
  }
  assert.equal(getDb(), db);
});

test("shared pools preserve session clocks and user lookup error propagation", async () => {
  const [defaultClock] = await getDb().execute<{ zone: string }>(
    sql`select current_setting('TimeZone') as zone`
  );
  const [utcClock] = await getDb("UTC").execute<{ zone: string }>(
    sql`select current_setting('TimeZone') as zone`
  );
  assert.equal(typeof defaultClock.zone, "string");
  assert.equal(utcClock.zone, "UTC");
  assert.equal(await getUserById("00000000-0000-4000-8000-000000000000"), null);
  await assert.rejects(getUserById("invalid-uuid"), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(
      error.message,
      "An error occurred while executing a database query."
    );
    assert.ok(error.cause);
    return true;
  });
});
