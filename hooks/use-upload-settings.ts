"use client";

import useSWR from "swr";
import {
  type UploadSettings,
  uploadSettingsSchema,
} from "@/lib/uploads/settings";

export const UPLOAD_SETTINGS_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/upload-settings`;
export async function fetchUploadSettings(
  url: string
): Promise<UploadSettings> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("upload-settings:unavailable");
  }
  return uploadSettingsSchema.parse(await response.json());
}
export function useUploadSettings() {
  return useSWR<UploadSettings>(UPLOAD_SETTINGS_URL, fetchUploadSettings, {
    refreshInterval: 30_000,
  });
}
