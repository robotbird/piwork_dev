"use client";

import { ArrowLeftIcon, ChevronUp } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ManagementUserNav({
  user,
}: {
  user: { email?: string | null; name?: string | null };
}) {
  const { setTheme, resolvedTheme } = useTheme();

  const displayName = user.email?.split("@")[0] ?? user.name?.trim() ?? "用户";
  const initial = (user.email?.[0] ?? displayName[0] ?? "R").toUpperCase();

  const handleThemeSelect = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const handleSignOut = useCallback(() => {
    signOut({
      redirectTo: "/",
    });
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-8 w-full items-center gap-2 overflow-hidden rounded-md bg-transparent px-2 text-left text-sm text-sidebar-accent-foreground outline-hidden transition-colors duration-150 hover:text-sidebar-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0"
          data-testid="management-user-nav-button"
          type="button"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/12 text-[12px] font-medium text-primary">
            {initial}
          </span>
          <span className="truncate text-sm" data-testid="management-user-name">
            {displayName}
          </span>
          <ChevronUp className="ml-auto size-3.5 text-sidebar-foreground/50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--radix-popper-anchor-width) rounded-md border border-border bg-card shadow-none"
        data-testid="management-user-nav-menu"
        side="top"
      >
        <DropdownMenuItem asChild>
          <Link className="cursor-pointer gap-2 text-sm" href="/">
            <ArrowLeftIcon className="size-3.5" />
            返回应用
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-sm"
          data-testid="management-user-nav-item-theme"
          onSelect={handleThemeSelect}
        >
          {`切换${resolvedTheme === "light" ? "深色" : "浅色"}模式`}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-sm"
          data-testid="management-user-nav-item-auth"
          onSelect={handleSignOut}
        >
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
