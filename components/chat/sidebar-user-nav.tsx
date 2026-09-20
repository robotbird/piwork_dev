"use client";

import {
  ChevronUp,
  LogInIcon,
  LogOutIcon,
  MoonIcon,
  Settings2Icon,
  SunIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { signOut, useSession } from "next-auth/react";
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
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { guestRegex } from "@/lib/constants";
import { LoaderIcon } from "./icons";
import { toast } from "./toast";

export function SidebarUserNav({ user }: { user: User }) {
  const { translate } = usePreferences();
  const router = useRouter();
  const { data, status } = useSession();
  const { setTheme, resolvedTheme } = useTheme();

  const isGuest = guestRegex.test(data?.user?.email ?? "");
  const handleThemeSelect = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const handleAuthClick = useCallback(() => {
    if (status === "loading") {
      toast({
        description: translate(
          "正在检查登录状态，请稍后再试！",
          "Checking authentication status, please try again!"
        ),
        type: "error",
      });

      return;
    }

    if (isGuest) {
      router.push("/login");
    } else {
      signOut({
        redirectTo: "/",
      });
    }
  }, [isGuest, router, status, translate]);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {status === "loading" ? (
              <SidebarMenuButton className="h-10 justify-between rounded-md bg-transparent text-sidebar-foreground/50 transition-colors duration-150 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                <div className="flex flex-row items-center gap-2">
                  <div className="size-6 animate-pulse rounded-full bg-sidebar-foreground/10" />
                  <span className="animate-pulse rounded-md bg-sidebar-foreground/10 text-transparent text-sm">
                    {translate("加载中...", "Loading...")}
                  </span>
                </div>
                <div className="animate-spin text-sidebar-foreground/50">
                  <LoaderIcon />
                </div>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                className="h-8 px-2 rounded-md bg-transparent text-sidebar-accent-foreground transition-colors duration-150 hover:text-sidebar-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                data-testid="user-nav-button"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/12 text-[12px] font-medium text-primary">
                  {isGuest ? "R" : (user.email?.[0] ?? "R").toUpperCase()}
                </span>
                <span className="truncate text-sm" data-testid="user-email">
                  {isGuest
                    ? "robotbird"
                    : (user.email?.split("@")[0] ?? translate("用户", "User"))}
                </span>
                <ChevronUp className="ml-auto size-3.5 text-sidebar-foreground/50" />
              </SidebarMenuButton>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-popper-anchor-width) rounded-md border border-border bg-card shadow-none"
            data-testid="user-nav-menu"
            side="top"
          >
            {isGuest ? null : (
              <>
                <DropdownMenuItem asChild>
                  <Link
                    className="cursor-pointer gap-2 text-sm"
                    data-testid="user-nav-item-management"
                    href="/management/skills"
                  >
                    <Settings2Icon className="size-3.5" />
                    {translate("管理", "Management")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-sm"
              data-testid="user-nav-item-theme"
              onSelect={handleThemeSelect}
            >
              {resolvedTheme === "light" ? (
                <MoonIcon className="size-3.5" />
              ) : (
                <SunIcon className="size-3.5" />
              )}
              {resolvedTheme === "light"
                ? translate("切换到深色模式", "Switch to dark mode")
                : translate("切换到浅色模式", "Switch to light mode")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-testid="user-nav-item-auth">
              <button
                className="w-full cursor-pointer gap-2 text-sm"
                onClick={handleAuthClick}
                type="button"
              >
                {isGuest ? (
                  <LogInIcon className="size-3.5" />
                ) : (
                  <LogOutIcon className="size-3.5" />
                )}
                {isGuest
                  ? translate("登录账户", "Log in to your account")
                  : translate("退出登录", "Sign out")}
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
