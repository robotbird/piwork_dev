"use client";

import {
  ArrowLeftIcon,
  ChevronUp,
  LogInIcon,
  LogOutIcon,
  MoonIcon,
  Settings2Icon,
  SunIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useCallback } from "react";
import { usePreferences } from "@/components/preferences-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { guestRegex } from "@/lib/constants";

type UserNavProps = {
  area: "app" | "admin";
  user: { email?: string | null; name?: string | null };
};

export function UserNav({ area, user }: UserNavProps) {
  const { t } = usePreferences();
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();

  const isGuest = guestRegex.test(user.email ?? "");
  const displayName = isGuest
    ? t("chat.logInToYourAccount")
    : (user.email?.split("@")[0] ?? user.name?.trim() ?? t("common.user"));
  const initial = (user.email?.[0] ?? displayName[0] ?? "R").toUpperCase();
  const testIdPrefix = area === "app" ? "user-nav" : "admin-user-nav";

  const handleThemeSelect = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const handleAuthSelect = useCallback(() => {
    if (isGuest) {
      router.push("/login");
      return;
    }

    signOut({ redirectTo: "/" });
  }, [isGuest, router]);

  return (
    <ul className="flex w-full min-w-0 flex-col gap-1">
      <li className="relative">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-8 w-full items-center gap-2 overflow-hidden rounded-md bg-transparent px-2 text-left text-sm text-sidebar-accent-foreground outline-hidden transition-colors duration-150 hover:text-sidebar-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:[&>span:not(:first-child)]:hidden group-data-[collapsible=icon]:[&>svg]:hidden"
              data-testid={`${testIdPrefix}-button`}
              type="button"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/12 text-[12px] font-medium text-primary">
                {isGuest ? (
                  <UserRoundIcon className="size-4" />
                ) : (
                  <span>{initial}</span>
                )}
              </span>
              <span
                className="truncate text-sm"
                data-testid={area === "app" ? "user-email" : "admin-user-name"}
              >
                {displayName}
              </span>
              <ChevronUp className="ml-auto size-3.5 text-sidebar-foreground/50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-popper-anchor-width) rounded-md border border-border bg-card shadow-none"
            data-testid={`${testIdPrefix}-menu`}
            side="top"
          >
            {area === "admin" ? (
              <DropdownMenuItem asChild>
                <Link className="cursor-pointer gap-2 text-sm" href="/">
                  <ArrowLeftIcon className="size-3.5" />
                  {t("common.backToApp")}
                </Link>
              </DropdownMenuItem>
            ) : isGuest ? null : (
              <DropdownMenuItem asChild>
                <Link
                  className="cursor-pointer gap-2 text-sm"
                  data-testid="user-nav-item-admin"
                  href="/admin"
                >
                  <Settings2Icon className="size-3.5" />
                  {t("chat.admin")}
                </Link>
              </DropdownMenuItem>
            )}
            {area === "admin" || !isGuest ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-sm"
              data-testid={`${testIdPrefix}-item-theme`}
              onSelect={handleThemeSelect}
            >
              {resolvedTheme === "light" ? (
                <MoonIcon className="size-3.5" />
              ) : (
                <SunIcon className="size-3.5" />
              )}
              {resolvedTheme === "light"
                ? t("chat.switchToDarkMode")
                : t("chat.switchToLightMode")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-sm"
              data-testid={`${testIdPrefix}-item-auth`}
              onSelect={handleAuthSelect}
            >
              {isGuest ? (
                <LogInIcon className="size-3.5" />
              ) : (
                <LogOutIcon className="size-3.5" />
              )}
              {isGuest ? t("chat.logInToYourAccount") : t("chat.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    </ul>
  );
}
