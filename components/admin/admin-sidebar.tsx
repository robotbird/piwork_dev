"use client";

import {
  ArrowLeftIcon,
  BlocksIcon,
  BrainIcon,
  Building2Icon,
  ContainerIcon,
  DatabaseIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  MenuIcon,
  PackageIcon,
  PlugIcon,
  SearchIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { UserNav } from "@/components/user-nav";
import { cn } from "@/lib/utils";

type NavigationItem = {
  href: string;
  icon: LucideIcon;
  labelKey: string;
  searchKeywordsKey: string;
};

type NavigationGroup = {
  labelKey: string;
  items: NavigationItem[];
};

const navigationGroups: NavigationGroup[] = [
  {
    items: [
      {
        href: "/admin",
        icon: LayoutDashboardIcon,
        labelKey: "overview",
        searchKeywordsKey: "overviewSearchKeywords",
      },
    ],
    labelKey: "workspace",
  },
  {
    items: [
      {
        href: "/admin/skills",
        icon: BlocksIcon,
        labelKey: "skillManagement",
        searchKeywordsKey: "skillManagementSearchKeywords",
      },
      {
        href: "/admin/tools?view=mcp",
        icon: PlugIcon,
        labelKey: "mcpServices",
        searchKeywordsKey: "mcpServicesSearchKeywords",
      },
      {
        href: "/admin/tools?view=pi-plugins",
        icon: PackageIcon,
        labelKey: "piPlugins",
        searchKeywordsKey: "piPluginsSearchKeywords",
      },
      {
        href: "/admin/data",
        icon: DatabaseIcon,
        labelKey: "dataManagement",
        searchKeywordsKey: "dataManagementSearchKeywords",
      },
      {
        href: "/admin/models",
        icon: BrainIcon,
        labelKey: "modelManagement",
        searchKeywordsKey: "modelManagementSearchKeywords",
      },
    ],
    labelKey: "agentResources",
  },
  {
    items: [
      {
        href: "/admin/organization",
        icon: Building2Icon,
        labelKey: "organization",
        searchKeywordsKey: "organizationSearchKeywords",
      },
      {
        href: "/admin/organization?view=members",
        icon: UsersRoundIcon,
        labelKey: "members",
        searchKeywordsKey: "membersSearchKeywords",
      },
      {
        href: "/admin/organization?view=permissions",
        icon: ShieldCheckIcon,
        labelKey: "rolesAndPermissions",
        searchKeywordsKey: "rolesAndPermissionsSearchKeywords",
      },
    ],
    labelKey: "organizationAndAccess",
  },
  {
    items: [
      {
        href: "/admin/sandboxes",
        icon: ContainerIcon,
        labelKey: "sandboxManagement",
        searchKeywordsKey: "sandboxManagementSearchKeywords",
      },
    ],
    labelKey: "runtimeAndSecurity",
  },
  {
    items: [
      {
        href: "/admin/settings",
        icon: SettingsIcon,
        labelKey: "generalSettings",
        searchKeywordsKey: "generalSettingsSearchKeywords",
      },
    ],
    labelKey: "systemSettings",
  },
];

function isItemActive(
  pathname: string,
  currentView: string | null,
  item: NavigationItem
) {
  const [hrefPath] = item.href.split("?");
  const itemView = new URLSearchParams(item.href.split("?")[1]).get("view");

  if (hrefPath === "/admin") {
    return pathname === hrefPath;
  }

  // 带 view 参数的条目要求 view 精确匹配；tools 的 mcp 是无参数时的默认视图
  if (itemView) {
    return (
      pathname === hrefPath &&
      (currentView === itemView ||
        (itemView === "mcp" && (currentView === null || currentView === "")))
    );
  }

  // 无 view 的基础条目（如组织架构）在带 view 参数时不激活
  if (currentView) {
    return false;
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
  const t = useTranslations("adminSidebar");
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
      <span className="truncate">{t(item.labelKey)}</span>
    </Link>
  );
}

function SidebarBody({
  onNavigate,
  user,
}: {
  onNavigate?: () => void;
  user: { image?: string | null; email?: string | null; name?: string | null };
}) {
  const t = useTranslations("adminSidebar");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleGroups = useMemo(
    () =>
      navigationGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) =>
            `${t(item.labelKey)} ${t(item.searchKeywordsKey)}`
              .toLocaleLowerCase()
              .includes(normalizedQuery)
          ),
        }))
        .filter((group) => group.items.length > 0),
    [normalizedQuery, t]
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
          <span className="sr-only">{t("searchManagement")}</span>
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground"
          />
          <input
            className="h-10 w-full rounded-[12px] border-0 bg-sidebar-accent/75 pl-10 pr-9 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring/45"
            onChange={handleQueryChange}
            placeholder={t("searchSettings")}
            type="search"
            value={query}
          />
          {query ? (
            <button
              aria-label={t("clearSearch")}
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
        aria-label={t("systemManagementNavigation")}
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-5"
      >
        {visibleGroups.length > 0 ? (
          visibleGroups.map((group, index) => (
            <Fragment key={group.labelKey}>
              <section className={cn(index > 0 && "mt-5")}>
                <h2 className="mb-1.5 px-2 text-[13px] font-medium leading-5 text-muted-foreground">
                  {t(group.labelKey)}
                </h2>
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={`${item.href}-${item.labelKey}`}>
                      <NavigationLink item={item} onNavigate={onNavigate} />
                    </li>
                  ))}
                </ul>
              </section>
            </Fragment>
          ))
        ) : (
          <div className="px-3 py-10 text-center text-sm text-muted-foreground">
            {t("noMatchingSettings")}
          </div>
        )}
      </nav>

      <div className="p-3">
        <UserNav area="admin" user={user} />
      </div>
    </div>
  );
}

export function AdminSidebar({
  user,
}: {
  user: { image?: string | null; email?: string | null; name?: string | null };
}) {
  const t = useTranslations("adminSidebar");
  const [mobileOpen, setMobileOpen] = useState(false);
  const handleOpenMobile = useCallback(() => setMobileOpen(true), []);
  const handleCloseMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
        <button
          aria-label={t("openManagementNavigation")}
          className="grid size-9 place-items-center rounded-lg text-foreground transition-colors hover:bg-muted"
          onClick={handleOpenMobile}
          type="button"
        >
          <MenuIcon className="size-5" />
        </button>
        <span className="text-sm font-medium">{t("systemManagement")}</span>
        <Link
          className="ml-auto rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          href="/"
        >
          {t("backToApp")}
        </Link>
      </header>

      <Sheet onOpenChange={setMobileOpen} open={mobileOpen}>
        <SheetContent
          className="w-[min(88vw,16.25rem)] border-r border-sidebar-border bg-sidebar p-0 [&>button]:hidden"
          showCloseButton={false}
          side="left"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t("systemManagementNavigation")}</SheetTitle>
            <SheetDescription>{t("navigationDescription")}</SheetDescription>
          </SheetHeader>
          <div className="flex h-full flex-col">
            <div className="flex h-14 shrink-0 items-center justify-between px-3">
              <Link
                className="group flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] leading-5 text-foreground transition-colors duration-150 hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground"
                href="/"
                onClick={handleCloseMobile}
              >
                <ArrowLeftIcon className="size-[18px] shrink-0 text-muted-foreground transition-all group-hover:-translate-x-0.5 group-hover:text-foreground" />
                {t("backToApp")}
              </Link>
              <button
                aria-label={t("closeManagementNavigation")}
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
          <span>{t("backToApp")}</span>
        </Link>
        <SidebarBody user={user} />
      </aside>
    </>
  );
}
