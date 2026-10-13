import { z } from "zod";

export const DEFAULT_UPLOAD_SETTINGS = { maxFileSizeMB: 100 } as const;
export const uploadSettingsSchema = z.strictObject({
  maxFileSizeMB: z.number().int().min(1).max(100),
});
export type UploadSettings = z.infer<typeof uploadSettingsSchema>;
export function uploadLimitBytes(settings: UploadSettings) {
  return uploadSettingsSchema.parse(settings).maxFileSizeMB * 1024 * 1024;
}
