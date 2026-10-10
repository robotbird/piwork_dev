import "../../support/db-env";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sql } from "drizzle-orm";
import { getDb } from "../../../lib/db/client";
import {
  getSandboxResourcePolicy,
  saveSandboxResourcePolicy,
} from "../../../lib/db/sandbox-settings-queries";
import {
  DEFAULT_SANDBOX_RESOURCE,
  LIGHT_SANDBOX_RESOURCE,
} from "../../../lib/runtime/sandbox/resource-policy";

test("sandbox settings persist in isolated schema, hot-read, reject invalid writes and propagate DB failures", {
  skip: !process.env.POSTGRES_URL,
}, async () => {
  const original = process.env.POSTGRES_URL;
  assert(original);
  const control = getDb();
  const schema = `sandbox_settings_${crypto.randomUUID().replaceAll("-", "")}`;
  const userId = crypto.randomUUID();
  try {
    await control.execute(sql.raw(`CREATE SCHEMA "${schema}"`));
    await control.execute(
      sql.raw(`CREATE TABLE "${schema}"."User" (id uuid PRIMARY KEY)`)
    );

    const url = new URL(original);
    url.searchParams.set("options", `-c search_path=${schema}`);
    process.env.POSTGRES_URL = url.toString();
    const db = getDb();
    const migration = await readFile(
      "lib/db/migrations/0021_greedy_santa_claus.sql",
      "utf8"
    );
    for (const statement of migration
      .replaceAll('"public"."User"', `"${schema}"."User"`)
      .split("--> statement-breakpoint")) {
      // biome-ignore lint/performance/noAwaitInLoops: migration statements must be sequential
      await db.execute(sql.raw(statement));
    }
    await db.execute(sql`INSERT INTO "User" (id) VALUES (${userId})`);
    assert.deepEqual(
      await getSandboxResourcePolicy(),
      DEFAULT_SANDBOX_RESOURCE
    );
    assert.deepEqual(
      await saveSandboxResourcePolicy(LIGHT_SANDBOX_RESOURCE, userId),
      LIGHT_SANDBOX_RESOURCE
    );
    assert.deepEqual(await getSandboxResourcePolicy(), LIGHT_SANDBOX_RESOURCE);
    await assert.rejects(
      saveSandboxResourcePolicy({ cpuCores: 1, memoryMB: 1 }, userId)
    );
    assert.deepEqual(await getSandboxResourcePolicy(), LIGHT_SANDBOX_RESOURCE);
    await saveSandboxResourcePolicy(DEFAULT_SANDBOX_RESOURCE, userId);
    assert.deepEqual(
      await getSandboxResourcePolicy(),
      DEFAULT_SANDBOX_RESOURCE
    );
    const rows = await db.execute(
      sql`SELECT "updatedBy" FROM "SandboxSettings"`
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].updatedBy, userId);
    await db.execute(sql`UPDATE "SandboxSettings" SET "memoryMB" = 1`);
    await assert.rejects(getSandboxResourcePolicy());
    await db.execute(sql`DROP TABLE "SandboxSettings"`);
    await assert.rejects(getSandboxResourcePolicy());
  } finally {
    process.env.POSTGRES_URL = original;
    await control.execute(sql.raw(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`));
  }
});
