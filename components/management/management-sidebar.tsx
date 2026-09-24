"use client";

import {
  ArrowLeftIcon,
  BlocksIcon,
  BrainIcon,
  Building2Icon,
  DatabaseIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  MenuIcon,
  SearchIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  type ChangeEvent,
  Fragment,
  useCallback,
  useMemo,
  useState,
} from "react";
import { usePreferences } from "@/components/preferences-provider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UserNav } from "@/components/user-nav";
import { cn } from "@/lib/utils";

type NavigationItem = {
  href: string;
  icon: LucideIcon;
  label: readonly [string, string];
  keywords?: string;
};

type NavigationGroup = {
  label: readonly [string, string];
  items: NavigationItem[];
};

const navigationGroups: NavigationGroup[] = [
  {
    items: [
      {
        href: "/management",
        icon: LayoutDashboardIcon,
        keywords: "工作台 仪表盘",
        label: ["概览", "Overview"],
      },
    ],
    label: ["工作台", "Workspace"],
  },
  {
    items: [
      {
        href: "/management/skills",
        icon: BlocksIcon,
        keywords: "技能 能力",
        label: ["Skill管理", "Skill management"],
      },
      {
        href: "/management/tools",
        icon: WrenchIcon,
        keywords: "MCP API 插件 接入",
        label: ["工具管理", "Tool management"],
      },
      {
        href: "/management/data",
        icon: DatabaseIcon,
        keywords: "知识库 数据集 文档",
        label: ["数据管理", "Data management"],
      },
      {
        href: "/management/models",
        icon: BrainIcon,
        keywords: "多模型 私有模型",
        label: ["模型管理", "Model management"],
      },
    ],
    label: ["智能体资源", "Agent resources"],
  },
  {
    items: [
      {
        href: "/management/organization",
        icon: Building2Icon,
        keywords: "部门 企业",
        label: ["组织架构", "Organization"],
      },
      {
        href: "/management/organization?view=members",
        icon: UsersRoundIcon,
        keywords: "用户 账号",
        label: ["成员管理", "Members"],
      },
      {
        href: "/management/organization?view=permissions",
        icon: ShieldCheckIcon,
        keywords: "安全 授权",
        label: ["角色与权限", "Roles & permissions"],
      },
    ],
    label: ["组织与权限", "Organization & access"],
  },
  {
    items: [
      {
        href: "/management/settings",
        icon: SettingsIcon,
        keywords:
          "系统 通用 设置 语言 外观 system general settings language appearance",
        label: ["通用设置", "General settings"],
      },
    ],
    label: ["系统设置", "System settings"],
  },
];

function isItemActive(
  pathname: string,
  currentView: string | null,
  item: NavigationItem
) {
  const [hrefPath] = item.href.split("?");
  const itemView = new URLSearchParams(item.href.split("?")[1]).get("view");

  if (hrefPath === "/management") {
    return pathname === hrefPath;
  }

  if (hrefPath === "/management/organization") {
    return pathname === hrefPath && currentView === itemView;
  }

  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}

function NavigationLink({
  item,
  onNavigate,
}: {
  item: NavigationItem;
  onNavigate?: () => void;
}) {
  const { translate } = usePreferences();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = isItemActive(pathname, searchParams.get("view"), item);
  const Icon = item.icon;

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] leading-5 outline-none transition-colors duration-150",
        "focus-visible:ring-2 focus-visible:ring-sidebar-ring/45 focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground"
      )}
      href={item.href}
      onClick={onNavigate}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-[18px] shrink-0 transition-colors",
          active
            ? "text-foreground"
            : "text-muted-foreground group-hover:text-foreground"
        )}
      />
      <span className="truncate">{translate(...item.label)}</span>
    </Link>
  );
}

function SidebarBody({
  onNavigate,
  user,
}: {
  onNavigate?: () => void;
  user: { email?: string | null; name?: string | null };
}) {
  const { translate } = usePreferences();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleGroups = useMemo(
    () =>
      navigationGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) =>
            `${item.label.join(" ")} ${item.keywords ?? ""}`
              .toLocaleLowerCase()
              .includes(normalizedQuery)
          ),
        }))
        .filter((group) => group.items.length > 0),
    [normalizedQuery]
  );
  const handleQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setQuery(event.currentTarget.value),
    []
  );
  const handleClearQuery = useCallback(() => setQuery(""), []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-3 pt-1">
        <label className="relative block">
          <span className="sr-only">
            {translate("搜索管理功能", "Search management")}
          </span>
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground"
          />
          <input
            className="h-10 w-full rounded-[12px] border-0 bg-sidebar-accent/75 pl-10 pr-9 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring/45"
            onChange={handleQueryChange}
            placeholder={translate("搜索设置", "Search settings")}
            type="search"
            value={query}
          />
          {query ? (
            <button
              aria-label={translate("清除搜索", "Clear search")}
              className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-background/70 hover:text-foreground"
              onClick={handleClearQuery}
              type="button"
            >
              <XIcon className="size-3.5" />
            </button>
          ) : null}
        </label>
      </div>

      <nav
        aria-label={translate("系统管理导航", "System management navigation")}
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-5"
      >
        {visibleGroups.length > 0 ? (
          visibleGroups.map((group, index) => (
            <Fragment key={group.label[0]}>
              <section className={cn(index > 0 && "mt-5")}>
                <h2 className="mb-1.5 px-2 text-[13px] font-medium leading-5 text-muted-foreground">
                  {translate(...group.label)}
                </h2>
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={`${item.href}-${item.label[0]}`}>
                      <NavigationLink item={item} onNavigate={onNavigate} />
                    </li>
                  ))}
                </ul>
              </section>
            </Fragment>
          ))
        ) : (
          <div className="px-3 py-10 text-center text-sm text-muted-foreground">
            {translate("没有匹配的设置", "No matching settings")}
          </div>
        )}
      </nav>

      <div className="p-3">
        <UserNav area="management" user={user} />
      </div>
    </div>
  );
}

export function ManagementSidebar({
  user,
}: {
  user: { email?: string | null; name?: string | null };
}) {
  const { translate } = usePreferences();
  const [mobileOpen, setMobileOpen] = useState(false);
  const handleOpenMobile = useCallback(() => setMobileOpen(true), []);
  const handleCloseMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
        <button
          aria-label={translate("打开管理导航", "Open management navigation")}
          className="grid size-9 place-items-center rounded-lg text-foreground transition-colors hover:bg-muted"
          onClick={handleOpenMobile}
          type="button"
        >
          <MenuIcon className="size-5" />
        </button>
        <span className="text-sm font-medium">
          {translate("系统管理", "System management")}
        </span>
        <Link
          className="ml-auto rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          href="/"
        >
          {translate("返回应用", "Back to app")}
        </Link>
      </header>

      <Sheet onOpenChange={setMobileOpen} open={mobileOpen}>
        <SheetContent
          className="w-[min(88vw,16.25rem)] border-r border-sidebar-border bg-sidebar p-0 [&>button]:hidden"
          showCloseButton={false}
          side="left"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>
              {translate("系统管理导航", "System management navigation")}
            </SheetTitle>
            <SheetDescription>
              {translate(
                "在系统管理功能之间切换",
                "Navigate system management features"
              )}
            </SheetDescription>
          </SheetHeader>
          <div className="flex h-full flex-col">
            <div className="flex h-14 shrink-0 items-center justify-between px-3">
              <Link
                className="group flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] leading-5 text-foreground transition-colors duration-150 hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground"
                href="/"
                onClick={handleCloseMobile}
              >
                <ArrowLeftIcon className="size-[18px] shrink-0 text-muted-foreground transition-all group-hover:-translate-x-0.5 group-hover:text-foreground" />
                {translate("返回应用", "Back to app")}
              </Link>
              <button
                aria-label={translate(
                  "关闭管理导航",
                  "Close management navigation"
                )}
                className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                onClick={handleCloseMobile}
                type="button"
              >
                <XIcon className="size-[18px]" />
              </button>
            </div>
            <SidebarBody onNavigate={handleCloseMobile} user={user} />
          </div>
        </SheetContent>
      </Sheet>

      <aside className="sticky top-0 hidden h-dvh w-65 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <Link
          className="group mx-3 mt-3 flex min-h-10 shrink-0 items-center gap-3 rounded-[10px] px-3 text-[14px] leading-5 text-foreground transition-colors duration-150 hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground"
          href="/"
        >
          <ArrowLeftIcon className="size-[18px] shrink-0 text-muted-foreground transition-all group-hover:-translate-x-0.5 group-hover:text-foreground" />
          <span>{translate("返回应用", "Back to app")}</span>
        </Link>
        <SidebarBody user={user} />
      </aside>
    </>
  );
}
