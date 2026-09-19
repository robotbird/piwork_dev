"use client";

import {
  ArrowLeftIcon,
  BoxesIcon,
  Building2Icon,
  CircleHelpIcon,
  DatabaseIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  NetworkIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersRoundIcon,
  WrenchIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

type NavigationItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

const navigationGroups: { label?: string; items: NavigationItem[] }[] = [
  {
    items: [{ href: "/management", icon: LayoutDashboardIcon, label: "概览" }],
  },
  {
    items: [
      { href: "/management/skills", icon: BoxesIcon, label: "企业技能库" },
    ],
    label: "Skill 管理",
  },
  {
    items: [
      {
        href: "/management/tools",
        icon: WrenchIcon,
        label: "MCP / API / 插件",
      },
      { href: "/management/tools", icon: NetworkIcon, label: "接入与管理" },
    ],
    label: "企业工具",
  },
  {
    items: [
      { href: "/management/data", icon: Building2Icon, label: "知识库" },
      { href: "/management/data", icon: DatabaseIcon, label: "数据集" },
    ],
    label: "企业数据",
  },
  {
    items: [
      { href: "/management/models", icon: NetworkIcon, label: "多模型接入" },
    ],
    label: "模型管理",
  },
  {
    items: [
      {
        href: "/management/organization",
        icon: UsersRoundIcon,
        label: "组织架构",
      },
      {
        href: "/management/organization",
        icon: UserRoundIcon,
        label: "成员管理",
      },
      {
        href: "/management/organization",
        icon: ShieldCheckIcon,
        label: "角色与权限",
      },
    ],
    label: "组织与用户",
  },
];

const footerItems: NavigationItem[] = [
  { href: "/management", icon: SettingsIcon, label: "系统设置" },
  { href: "/management", icon: CircleHelpIcon, label: "帮助与支持" },
];

function isItemActive(pathname: string, item: NavigationItem) {
  if (item.href === "/management") {
    return pathname === item.href && item.label === "概览";
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavigationLink({ item }: { item: NavigationItem }) {
  const pathname = usePathname();
  const active = isItemActive(pathname, item);
  const Icon = item.icon;

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-md px-4 text-sm transition-colors",
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
      href={item.href}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          active ? "text-primary" : "text-muted-foreground"
        )}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function NavigationContent() {
  return (
    <>
      <nav aria-label="管理功能导航" className="flex-1 px-2 pb-4">
        {navigationGroups.map((group, groupIndex) => (
          <Fragment key={group.label ?? "overview"}>
            {group.label ? (
              <div className="mt-4 flex items-center gap-3 px-3 pb-1.5">
                <span className="shrink-0 text-[12px] font-medium text-muted-foreground">
                  {group.label}
                </span>
                <i className="h-px flex-1 bg-border" />
              </div>
            ) : null}
            <ul className={cn("space-y-0.5", groupIndex === 0 && "pt-1")}>
              {group.items.map((item) => (
                <li key={item.label}>
                  <NavigationLink item={item} />
                </li>
              ))}
            </ul>
          </Fragment>
        ))}
      </nav>
      <div className="border-t border-border px-2 py-3">
        {footerItems.map((item) => (
          <NavigationLink item={item} key={item.label} />
        ))}
      </div>
    </>
  );
}

export function ManagementSidebar({
  user: _user,
}: {
  user: { email?: string | null; name?: string | null };
}) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-sidebar px-3 py-2 md:hidden">
        <Link
          className="group flex h-10 w-fit items-center gap-2 rounded-md px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-sidebar-accent"
          href="/"
        >
          <ArrowLeftIcon className="size-5 transition-transform group-hover:-translate-x-0.5" />
          返回应用
        </Link>
        <div className="mt-3 flex gap-1 overflow-x-auto no-scrollbar">
          {navigationGroups
            .flatMap((group) => group.items)
            .map((item) => (
              <div className="shrink-0" key={item.label}>
                <NavigationLink item={item} />
              </div>
            ))}
        </div>
      </header>

      <aside className="hidden h-dvh w-[248px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:sticky md:top-0 md:flex">
        <Link
          className="group mx-3 flex h-14 shrink-0 items-center gap-2.5 rounded-md px-3 text-base font-medium text-foreground transition-colors hover:bg-sidebar-accent"
          href="/"
        >
          <ArrowLeftIcon className="size-5 transition-transform group-hover:-translate-x-0.5" />
          <span>返回应用</span>
        </Link>
        <div className="min-h-0 flex flex-1 flex-col overflow-y-auto">
          <NavigationContent />
        </div>
      </aside>
    </>
  );
}
