import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_UPLOAD_SETTINGS,
  uploadLimitBytes,
  uploadSettingsSchema,
} from "../../../lib/uploads/settings";

test("upload policy accepts integer boundaries and rejects malformed or expanded policies", () => {
  assert.equal(uploadLimitBytes(DEFAULT_UPLOAD_SETTINGS), 100 * 1024 * 1024);
  assert.equal(uploadLimitBytes({ maxFileSizeMB: 1 }), 1024 * 1024);
  for (const maxFileSizeMB of [
    0,
    -1,
    101,
    1.5,
    "20",
    null,
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ]) {
    assert.equal(
      uploadSettingsSchema.safeParse({ maxFileSizeMB }).success,
      false
    );
  }
  assert.equal(
    uploadSettingsSchema.safeParse({ extra: true, maxFileSizeMB: 50 }).success,
    false
  );
});
