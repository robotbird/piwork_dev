import { en } from "./locales/en";
import { zhCN } from "./locales/zh-cn";
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
  const messages = locales[language].messages as Record<string, string>;
  // 中文键即源文案：默认语言下直接使用键本身，英文 fallback 仅对非默认语言生效
  const message =
    messages[key] ?? (language === DEFAULT_LANGUAGE ? key : (fallback ?? key));
  return interpolate(message, params);
}

export type { TranslationParams } from "./types";
