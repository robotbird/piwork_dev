import { en } from "./locales/en";
import { zhCN } from "./locales/zh-CN";
import { interpolate, type TranslationParams } from "./types";

export const locales = {
  en,
  "zh-CN": zhCN,
} as const;

export type AppLanguage = keyof typeof locales;

export const DEFAULT_LANGUAGE: AppLanguage = "zh-CN";

export const localeOptions = Object.entries(locales).map(([value, locale]) => ({
  label: locale.label,
  value: value as AppLanguage,
}));

export function isAppLanguage(value: string | null): value is AppLanguage {
  return value !== null && value in locales;
}

export function getTranslation(
  language: AppLanguage,
  key: string,
  params?: TranslationParams,
  fallback?: string
): string {
  const message = locales[language].messages[key] ?? fallback ?? key;
  return interpolate(message, params);
}

export type { TranslationParams } from "./types";
