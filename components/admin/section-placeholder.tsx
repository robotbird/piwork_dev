"use client";

import { ArrowRightIcon } from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import { Badge } from "@/components/ui/badge";
import type { AdminSection } from "@/lib/admin/sections";

export function SectionPlaceholder({
  section,
}: {
  section: AdminSection;
}) {
  const Icon = section.icon;
  const { t } = usePreferences();

  return (
    <main className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-12 lg:py-16">
      <div className="mx-auto max-w-[960px]">
        <header>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-[-0.025em]">
              {t(section.title)}
            </h1>
            {section.ready ? null : (
              <Badge variant="secondary">{t("admin.comingSoon")}</Badge>
            )}
          </div>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-muted-foreground">
            {t(section.description)}
          </p>
        </header>

        <section className="mt-10">
          <h2 className="mb-3 text-[15px] font-semibold text-foreground">
            {t(section.tagline)}
          </h2>
          <div className="overflow-hidden rounded-[14px] border border-border bg-card">
            {section.features.map((feature) => (
              <div
                className="group flex min-h-[76px] items-center gap-4 border-b border-border px-5 py-4 last:border-b-0"
                key={feature}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-muted text-foreground">
                  <Icon className="size-[17px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-foreground">
                    {t(feature)}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-5 text-muted-foreground">
                    {t("admin.thisFeatureIsPlannedAndWillBe")}
                  </span>
                </span>
                <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
