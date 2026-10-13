import "../../support/db-env";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sql } from "drizzle-orm";
import { getDb } from "../../../lib/db/client";
import {
  getUploadSettings,
  saveUploadSettings,
} from "../../../lib/db/upload-settings-queries";
import { DEFAULT_UPLOAD_SETTINGS } from "../../../lib/uploads/settings";

const SMALL_UPLOAD_SETTINGS = { maxFileSizeMB: 1 };

test("upload settings persist in isolated schema, hot-read, reject invalid writes and propagate DB failures", {
  skip: !process.env.POSTGRES_URL,
}, async () => {
  const original = process.env.POSTGRES_URL;
  assert(original);
  const control = getDb();
  const schema = `upload_settings_${crypto.randomUUID().replaceAll("-", "")}`;
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
      "lib/db/migrations/0023_upload_settings.sql",
      "utf8"
    );
    for (const statement of migration
      .replaceAll('"public"."User"', `"${schema}"."User"`)
      .split("--> statement-breakpoint")) {
      // biome-ignore lint/performance/noAwaitInLoops: migration statements must be sequential
      await db.execute(sql.raw(statement));
    }
    await db.execute(sql`INSERT INTO "User" (id) VALUES (${userId})`);
    assert.deepEqual(await getUploadSettings(), DEFAULT_UPLOAD_SETTINGS);
    assert.deepEqual(
      await saveUploadSettings(SMALL_UPLOAD_SETTINGS, userId),
      SMALL_UPLOAD_SETTINGS
    );
    assert.deepEqual(await getUploadSettings(), SMALL_UPLOAD_SETTINGS);
    await assert.rejects(saveUploadSettings({ maxFileSizeMB: 101 }, userId));
    assert.deepEqual(await getUploadSettings(), SMALL_UPLOAD_SETTINGS);
    await saveUploadSettings(DEFAULT_UPLOAD_SETTINGS, userId);
    assert.deepEqual(await getUploadSettings(), DEFAULT_UPLOAD_SETTINGS);
    const rows = await db.execute(
      sql`SELECT "updatedBy" FROM "UploadSettings"`
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].updatedBy, userId);
    await db.execute(sql`UPDATE "UploadSettings" SET "maxFileSizeMB" = 101`);
    await assert.rejects(getUploadSettings());
    await db.execute(sql`DROP TABLE "UploadSettings"`);
    await assert.rejects(getUploadSettings());
  } finally {
    process.env.POSTGRES_URL = original;
    await control.execute(sql.raw(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`));
  }
});
