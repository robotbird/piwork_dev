"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type AppLanguage,
  DEFAULT_LANGUAGE,
  getTranslation,
  isAppLanguage,
  type TranslationParams,
} from "@/lib/i18n";

export type { AppLanguage } from "@/lib/i18n";

const LANGUAGE_STORAGE_KEY = "piwork-language";

type PreferencesContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: string, params?: TranslationParams) => string;
  translate: (chinese: string, english: string) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isAppLanguage(storedLanguage)) {
      setLanguageState(storedLanguage);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  }, []);

  const t = useCallback(
    (key: string, params?: TranslationParams) =>
      getTranslation(language, key, params),
    [language]
  );
  const translate = useCallback(
    (chinese: string, english: string) =>
      getTranslation(language, chinese, undefined, english),
    [language]
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
