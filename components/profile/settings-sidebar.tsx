"use client";

import { ArrowLeft, BarChart3, LockKeyhole, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePreferences } from "@/components/preferences-provider";
import { cn } from "@/lib/utils";

const sections = [
  { href: "/settings/profile", icon: UserRound, label: "title" },
  { href: "/settings/security", icon: LockKeyhole, label: "password" },
  { href: "/settings/usage", icon: BarChart3, label: "usage" },
];

export function SettingsSidebar() {
  const pathname = usePathname();
  const { t } = usePreferences();
  return (
    <aside className="border-b border-sidebar-border bg-sidebar p-3 md:w-65 md:shrink-0 md:border-b-0 md:border-r">
      <Link
        className="group mb-6 flex min-h-10 shrink-0 items-center gap-3 rounded-[10px] px-3 text-[14px] leading-5 text-foreground transition-colors duration-150 hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground"
        href="/"
      >
        <ArrowLeft className="size-[18px] shrink-0 text-muted-foreground transition-all group-hover:-translate-x-0.5 group-hover:text-foreground" />
        {t("common.backToApp")}
      </Link>
      <p className="mb-3 text-xs text-muted-foreground">
        {t("profile.settings")}
      </p>
      <nav
        aria-label={t("profile.settings")}
        className="flex gap-1 md:flex-col"
      >
        {sections.map(({ href, icon: Icon, label }) => (
          <Link
            aria-current={pathname === href ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-3 text-sm",
              pathname === href
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent"
            )}
            href={href}
            key={href}
          >
            <Icon className="size-5" />
            {t(`profile.${label}`)}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
