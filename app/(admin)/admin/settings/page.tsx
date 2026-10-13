"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { UploadSettingsSection } from "@/components/admin/upload-settings-section";
import {
  type AppLanguage,
  usePreferences,
} from "@/components/preferences-provider";
import { localeOptions } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const appearanceOptions = [
  { labelKey: "light", value: "light" },
  { labelKey: "dark", value: "dark" },
  { labelKey: "system", value: "system" },
] as const;

export default function GeneralSettingsPage() {
  const { language, setLanguage } = usePreferences();
  const t = useTranslations("settings");
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const selectedTheme = mounted ? (theme ?? "system") : "system";
  const handleLanguageChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setLanguage(event.currentTarget.value as AppLanguage);
    },
    [setLanguage]
  );
  const handleThemeChange = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      setTheme(event.currentTarget.value);
    },
    [setTheme]
  );

  return (
    <main className="min-w-0 flex-1 bg-background px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header>
          <h1 className="text-2xl font-medium leading-8 tracking-tight text-foreground">
            {t("generalSettings")}
          </h1>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {t("configureThePlatformSCoreExperience")}
          </p>
        </header>

        <section className="mt-8">
          <h2 className="text-base font-medium leading-6">
            {t("preferences")}
          </h2>
          <div className="mt-4 overflow-hidden rounded-[14px] border border-border bg-card">
            <div className="flex min-h-16 flex-col items-stretch justify-between gap-4 px-4 py-3 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-sm font-medium leading-5 text-foreground">
                  {t("interfaceLanguage")}
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("chooseTheLanguageUsedAcrossThePlatform")}
                </p>
              </div>
              <label className="relative shrink-0">
                <span className="sr-only">{t("interfaceLanguage")}</span>
                <select
                  className="h-11 w-full appearance-none rounded-[10px] border border-border bg-background py-0 pl-3 pr-9 text-sm text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 sm:h-9 sm:w-[170px]"
                  onChange={handleLanguageChange}
                  value={language}
                >
                  {localeOptions.map((locale) => (
                    <option key={locale.value} value={locale.value}>
                      {locale.label}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </label>
            </div>
            <div className="mx-4 border-t border-border" />
            <div className="flex min-h-16 flex-col items-stretch justify-between gap-4 px-4 py-3 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-sm font-medium leading-5 text-foreground">
                  {t("appearance")}
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("chooseLightDarkOrMatchYourSystem")}
                </p>
              </div>
              <div className="grid w-full shrink-0 grid-cols-3 overflow-hidden rounded-[10px] border border-border bg-background p-0.5 sm:w-[288px]">
                {appearanceOptions.map((option) => {
                  const active = selectedTheme === option.value;
                  return (
                    <button
                      aria-pressed={active}
                      className={cn(
                        "relative flex h-11 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-sm transition-colors sm:h-8",
                        active
                          ? "bg-link-soft text-link"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      key={option.value}
                      onClick={handleThemeChange}
                      type="button"
                      value={option.value}
                    >
                      {active ? <CheckIcon className="size-3.5" /> : null}
                      {t(option.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
        <UploadSettingsSection />
      </div>
    </main>
  );
}
