"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import type { AppLanguage, TranslationParams } from "@/lib/i18n";
import { legacyMessageKeys } from "@/lib/i18n/legacy-keys";

export type { AppLanguage } from "@/lib/i18n";

type PreferencesContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: string, params?: TranslationParams) => string;
  translate: (chinese: string, english: string) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const language = useLocale() as AppLanguage;
  const messages = useTranslations();
  const router = useRouter();

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback(
    (nextLanguage: AppLanguage) => {
      // biome-ignore lint/suspicious/noDocumentCookie: The locale cookie must be available to the next server request.
      document.cookie = `NEXT_LOCALE=${nextLanguage}; path=/; SameSite=Lax`;
      router.refresh();
    },
    [router]
  );

  const t = useCallback(
    (key: string, params?: TranslationParams) => {
      const messageKey =
        legacyMessageKeys[key as keyof typeof legacyMessageKeys];
      return messageKey ? messages(messageKey, params) : key;
    },
    [messages]
  );
  const translate = useCallback(
    (chinese: string, english: string) =>
      t(chinese) === chinese && language === "en" ? english : t(chinese),
    [language, t]
  );

  const value = useMemo(
    () => ({ language, setLanguage, t, translate }),
    [language, setLanguage, t, translate]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error("usePreferences must be used inside PreferencesProvider");
  }

  return context;
}
