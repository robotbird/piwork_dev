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
    <main className="min-w-0 flex-1 bg-background px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-20 lg:py-16">
      <div className="max-w-none">
        <header>
          <h1 className="text-[30px] font-semibold leading-10 tracking-[-0.035em] text-foreground">
            {t("generalSettings")}
          </h1>
          <p className="mt-1 text-[15px] leading-6 text-muted-foreground">
            {t("configureThePlatformSCoreExperience")}
          </p>
        </header>

        <section className="mt-12">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em]">
            {t("language")}
          </h2>
          <div className="mt-5 flex min-h-[112px] items-center justify-between gap-6 rounded-[14px] border border-border bg-card px-7 py-5">
            <div>
              <h3 className="text-[16px] font-medium text-foreground">
                {t("interfaceLanguage")}
              </h3>
              <p className="mt-1 text-[14px] text-muted-foreground">
                {t("chooseTheLanguageUsedAcrossThePlatform")}
              </p>
            </div>
            <label className="relative shrink-0">
              <span className="sr-only">{t("interfaceLanguage")}</span>
              <select
                className="h-11 min-w-[170px] appearance-none rounded-[10px] border border-border bg-background py-0 pl-4 pr-11 text-[14px] font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
                onChange={handleLanguageChange}
                value={language}
              >
                {localeOptions.map((locale) => (
                  <option key={locale.value} value={locale.value}>
                    {locale.label}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </label>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em]">
            {t("appearance")}
          </h2>
          <div className="mt-5 flex min-h-[112px] items-center justify-between gap-6 rounded-[14px] border border-border bg-card px-7 py-5">
            <div>
              <h3 className="text-[16px] font-medium text-foreground">
                {t("appearance")}
              </h3>
              <p className="mt-1 text-[14px] text-muted-foreground">
                {t("chooseLightDarkOrMatchYourSystem")}
              </p>
            </div>
            <div className="grid shrink-0 grid-cols-3 overflow-hidden rounded-[10px] border border-border bg-background p-0.5">
              {appearanceOptions.map((option) => {
                const active = selectedTheme === option.value;
                return (
                  <button
                    aria-pressed={active}
                    className={cn(
                      "relative flex h-10 min-w-[90px] items-center justify-center gap-1.5 rounded-lg px-4 text-[14px] font-medium transition-colors",
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
        </section>
      </div>
    </main>
  );
}
