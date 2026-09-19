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
  ShieldCheckIcon,
  UserRoundIcon,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavigationItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  keywords?: string;
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

const navigationGroups: NavigationGroup[] = [
  {
    items: [
      {
        href: "/management",
        icon: LayoutDashboardIcon,
        keywords: "工作台 仪表盘",
        label: "概览",
      },
    ],
    label: "工作台",
  },
  {
    items: [
      {
        href: "/management/skills",
        icon: BlocksIcon,
        keywords: "技能 能力",
        label: "企业 Skill 库",
      },
      {
        href: "/management/tools",
        icon: WrenchIcon,
        keywords: "MCP API 插件 接入",
        label: "企业工具",
      },
      {
        href: "/management/data",
        icon: DatabaseIcon,
        keywords: "知识库 数据集 文档",
        label: "企业数据",
      },
      {
        href: "/management/models",
        icon: BrainIcon,
        keywords: "多模型 私有模型",
        label: "模型管理",
      },
    ],
    label: "智能体资源",
  },
  {
    items: [
      {
        href: "/management/organization",
        icon: Building2Icon,
        keywords: "部门 企业",
        label: "组织架构",
      },
      {
        href: "/management/organization?view=members",
        icon: UsersRoundIcon,
        keywords: "用户 账号",
        label: "成员管理",
      },
      {
        href: "/management/organization?view=permissions",
        icon: ShieldCheckIcon,
        keywords: "安全 授权",
        label: "角色与权限",
      },
    ],
    label: "组织与权限",
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
      <span className="truncate">{item.label}</span>
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
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleGroups = useMemo(
    () =>
      navigationGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) =>
            `${item.label} ${item.keywords ?? ""}`
              .toLocaleLowerCase()
              .includes(normalizedQuery)
          ),
        }))
        .filter((group) => group.items.length > 0),
    [normalizedQuery]
  );
  const displayName = user.name?.trim() || "管理员";
  const initial = displayName.slice(0, 1).toLocaleUpperCase();
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
          <span className="sr-only">搜索管理功能</span>
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground"
          />
          <input
            className="h-10 w-full rounded-[12px] border-0 bg-sidebar-accent/75 pl-10 pr-9 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring/45"
            onChange={handleQueryChange}
            placeholder="搜索设置"
            type="search"
            value={query}
          />
          {query ? (
            <button
              aria-label="清除搜索"
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
        aria-label="系统管理导航"
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-5"
      >
        {visibleGroups.length > 0 ? (
          visibleGroups.map((group, index) => (
            <Fragment key={group.label}>
              <section className={cn(index > 0 && "mt-5")}>
                <h2 className="mb-1.5 px-2 text-[13px] font-medium leading-5 text-muted-foreground">
                  {group.label}
                </h2>
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <NavigationLink item={item} onNavigate={onNavigate} />
                    </li>
                  ))}
                </ul>
              </section>
            </Fragment>
          ))
        ) : (
          <div className="px-3 py-10 text-center text-sm text-muted-foreground">
            没有匹配的设置
          </div>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex min-w-0 items-center gap-3 rounded-[10px] px-2 py-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-xs font-medium text-background">
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-foreground">
              {displayName}
            </span>
            {user.email ? (
              <span className="block truncate text-[12px] text-muted-foreground">
                {user.email}
              </span>
            ) : null}
          </span>
          <UserRoundIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </div>
      </div>
    </div>
  );
}

export function ManagementSidebar({
  user,
}: {
  user: { email?: string | null; name?: string | null };
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const handleOpenMobile = useCallback(() => setMobileOpen(true), []);
  const handleCloseMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
        <button
          aria-label="打开管理导航"
          className="grid size-9 place-items-center rounded-lg text-foreground transition-colors hover:bg-muted"
          onClick={handleOpenMobile}
          type="button"
        >
          <MenuIcon className="size-5" />
        </button>
        <span className="text-sm font-medium">系统管理</span>
        <Link
          className="ml-auto rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          href="/"
        >
          返回应用
        </Link>
      </header>

      <Sheet onOpenChange={setMobileOpen} open={mobileOpen}>
        <SheetContent
          className="w-[min(88vw,17rem)] border-r border-sidebar-border bg-sidebar p-0 [&>button]:hidden"
          showCloseButton={false}
          side="left"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>系统管理导航</SheetTitle>
            <SheetDescription>在系统管理功能之间切换</SheetDescription>
          </SheetHeader>
          <div className="flex h-full flex-col">
            <div className="flex h-14 shrink-0 items-center justify-between px-3">
              <Link
                className="group flex h-10 items-center gap-2 rounded-[10px] px-2 text-[15px] font-medium text-foreground transition-colors hover:bg-sidebar-accent"
                href="/"
                onClick={handleCloseMobile}
              >
                <ArrowLeftIcon className="size-5 transition-transform group-hover:-translate-x-0.5" />
                返回应用
              </Link>
              <button
                aria-label="关闭管理导航"
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

      <aside className="sticky top-0 hidden h-dvh w-[272px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <Link
          className="group mx-3 flex h-14 shrink-0 items-center gap-2.5 rounded-[10px] px-2 text-[15px] font-medium text-foreground transition-colors hover:bg-sidebar-accent"
          href="/"
        >
          <ArrowLeftIcon className="size-5 transition-transform group-hover:-translate-x-0.5" />
          <span>返回应用</span>
        </Link>
        <SidebarBody user={user} />
      </aside>
    </>
  );
}
