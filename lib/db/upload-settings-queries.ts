import "server-only";
import { eq, sql } from "drizzle-orm";
import {
  DEFAULT_UPLOAD_SETTINGS,
  type UploadSettings,
  uploadSettingsSchema,
} from "../uploads/settings";
import { getDb } from "./client";
import { uploadSettings } from "./schema";

// New uploads see the latest committed policy; DB failures never use defaults.
export async function getUploadSettings(): Promise<UploadSettings> {
  const [row] = await getDb()
    .select({ maxFileSizeMB: uploadSettings.maxFileSizeMB })
    .from(uploadSettings)
    .where(eq(uploadSettings.id, "default"));
  return uploadSettingsSchema.parse(row ?? DEFAULT_UPLOAD_SETTINGS);
}

export async function saveUploadSettings(
  input: UploadSettings,
  userId: string
) {
  const policy = uploadSettingsSchema.parse(input);
  const [row] = await getDb()
    .insert(uploadSettings)
    .values({ ...policy, id: "default", updatedBy: userId })
    .onConflictDoUpdate({
      set: { ...policy, updatedAt: sql`now()`, updatedBy: userId },
      target: uploadSettings.id,
    })
    .returning({ maxFileSizeMB: uploadSettings.maxFileSizeMB });
  return uploadSettingsSchema.parse(row);
}
