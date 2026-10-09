"use client";

import {
  ArrowLeftIcon,
  ChevronUp,
  LogOutIcon,
  MoonIcon,
  Settings2Icon,
  SunIcon,
  UserRoundIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
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

type UserNavProps = {
  area: "app" | "admin";
  isAdmin?: boolean;
  user: { image?: string | null; email?: string | null; name?: string | null };
};

export function UserNav({ area, user, isAdmin = false }: UserNavProps) {
  const { t } = usePreferences();
  const { setTheme, resolvedTheme } = useTheme();

  const displayName =
    user.name?.trim() || user.email?.split("@")[0] || t("common.user");
  const initial = (displayName[0] ?? "R").toUpperCase();
  const testIdPrefix = area === "app" ? "user-nav" : "admin-user-nav";

  const handleThemeSelect = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const handleAuthSelect = useCallback(async () => {
    // redirect: false：服务端会基于内部 origin（反代后是
    // http://localhost:<port>）拼出绝对跳转 URL，浏览器会被带离站点；
    // 这里改为相对跳转，兼容本地与任意线上入口。
    await signOut({ redirectTo: "/login", redirect: false });
    window.location.assign("/login");
  }, []);

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
                {user.image ? (
                  <Image
                    alt={displayName}
                    className="size-7 rounded-full object-cover"
                    height={28}
                    src={user.image}
                    unoptimized
                    width={28}
                  />
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
            ) : isAdmin ? (
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
            ) : null}
            <DropdownMenuItem asChild>
              <Link
                className="cursor-pointer gap-2 text-sm"
                data-testid="user-nav-item-profile"
                href="/settings/profile"
              >
                <UserRoundIcon className="size-3.5" />
                {t("profile.title")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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
              <LogOutIcon className="size-3.5" />
              {t("chat.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    </ul>
  );
}
