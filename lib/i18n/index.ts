export const APP_LANGUAGES = ["zh", "en"] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = "zh";

export const localeOptions: ReadonlyArray<{
  label: string;
  value: AppLanguage;
}> = [
  { label: "中文", value: "zh" },
  { label: "English", value: "en" },
];

export function isAppLanguage(value: string | null): value is AppLanguage {
  return value !== null && APP_LANGUAGES.includes(value as AppLanguage);
}

export function normalizeLanguage(value: string): AppLanguage | null {
  for (const entry of value.toLowerCase().split(",")) {
    const [languageTag] = entry.trim().split(";");
    if (languageTag === "zh" || languageTag.startsWith("zh-")) {
      return "zh";
    }
    if (languageTag === "en" || languageTag.startsWith("en-")) {
      return "en";
    }
  }
  return null;
}

export type { TranslationParams } from "./types";
