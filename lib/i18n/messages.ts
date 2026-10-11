import { type AbstractIntlMessages, createTranslator } from "use-intl/core";
import en from "@/i18n/messages/en.json";
import zh from "@/i18n/messages/zh.json";
import { DEFAULT_LANGUAGE, normalizeLanguage } from "./index";
import type { TranslationParams } from "./types";

/** For pure domain helpers without a request or React context. Callers may supply a locale. */
export function translateMessage(
  key: string,
  params: TranslationParams = {},
  locale: string = DEFAULT_LANGUAGE
): string {
  const language = normalizeLanguage(locale) ?? DEFAULT_LANGUAGE;
  const t = createTranslator({
    locale: language,
    messages: (language === "en" ? en : zh) as AbstractIntlMessages,
  });
  return (t as (messageKey: string, values: TranslationParams) => string)(
    key,
    params
  );
}

/** Preserve safe default text for background jobs while exposing a key to request boundaries. */
export class LocalizedError extends Error {
  readonly messageKey: string;
  readonly params: TranslationParams;

  constructor(messageKey: string, params: TranslationParams = {}) {
    super(translateMessage(messageKey, params));
    this.messageKey = messageKey;
    this.params = params;
  }
}
