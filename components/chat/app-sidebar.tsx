"use client";

import {
  BarChart3Icon,
  Clock3Icon,
  CompassIcon,
  FileCheck2Icon,
  FileTextIcon,
  FolderIcon,
  Grid2X2Icon,
  HomeIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  SearchIcon,
  SquarePenIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useCallback } from "react";
import { toast } from "sonner";
import { BrandMark } from "@/components/chat/brand-mark";
import { SidebarHistory } from "@/components/chat/sidebar-history";
import { SidebarUserNav } from "@/components/chat/sidebar-user-nav";
import { usePreferences } from "@/components/preferences-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const primaryItems = [
  { icon: FileTextIcon, label: ["我的文档", "My documents"] as const },
  { icon: Clock3Icon, label: ["定时任务", "Scheduled tasks"] as const },
  { href: "/skills", icon: Grid2X2Icon, label: ["Skill", "Skills"] as const },
  { icon: CompassIcon, label: ["探索", "Explore"] as const },
];

const workspaceItems = [
  { icon: HomeIcon, label: ["我的项目", "My projects"] as const },
  { icon: BarChart3Icon, label: ["经营分析", "Business analysis"] as const },
  { icon: FileCheck2Icon, label: ["合同审核", "Contract review"] as const },
  { icon: FolderIcon, label: ["市场研究", "Market research"] as const },
];

export function AppSidebar({ user }: { user: User | undefined }) {
  const { translate } = usePreferences();
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile, toggleSidebar } = useSidebar();

  const handleNewChat = useCallback(() => {
    setOpenMobile(false);
    router.push("/");
  }, [router, setOpenMobile]);

  const handleCloseMobile = useCallback(
    () => setOpenMobile(false),
    [setOpenMobile]
  );

  const handleComingSoon = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      toast.info(
        translate(
          `${event.currentTarget.dataset.label}即将开放`,
          `${event.currentTarget.dataset.label} is coming soon`
        )
      );
    },
    [translate]
  );

  return (
    <Sidebar
      className="openai-sidebar border-r border-sidebar-border"
      collapsible="icon"
    >
      <SidebarHeader className="px-3 pb-4 pt-3 group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:pb-2">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <Link
            className="ml-2 flex h-10 items-center group-data-[collapsible=icon]:hidden"
            href="/"
            onClick={handleCloseMobile}
          >
            <span className="text-[20px] font-semibold tracking-[-0.03em] text-sidebar-accent-foreground">
              PiWork
            </span>
          </Link>
          <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
            <button
              aria-label={translate("搜索", "Search")}
              className="grid size-9 place-items-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              data-label={translate("搜索", "Search")}
              onClick={handleComingSoon}
              type="button"
            >
              <SearchIcon className="size-[18px]" />
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-label={translate("收起侧边栏", "Collapse sidebar")}
                  className="grid size-9 place-items-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                  onClick={toggleSidebar}
                  type="button"
                >
                  <PanelLeftCloseIcon className="size-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                className="rounded-lg px-3 py-2 text-sm"
                side="right"
                sideOffset={8}
              >
                {translate("收起侧边栏", "Collapse sidebar")}
              </TooltipContent>
            </Tooltip>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label={translate("打开侧边栏", "Open sidebar")}
                className="group/collapsed-toggle relative hidden size-10 place-items-center rounded-xl text-sidebar-accent-foreground transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:grid"
                onClick={toggleSidebar}
                type="button"
              >
                <BrandMark className="size-7 transition-opacity duration-150 group-hover/collapsed-toggle:opacity-0 group-focus-visible/collapsed-toggle:opacity-0" />
                <PanelLeftOpenIcon className="absolute size-5 opacity-0 transition-opacity duration-150 group-hover/collapsed-toggle:opacity-100 group-focus-visible/collapsed-toggle:opacity-100" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              className="rounded-lg px-3 py-2 text-sm"
              side="right"
              sideOffset={8}
            >
              {translate("打开侧边栏", "Open sidebar")}
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 pt-0">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="h-10 rounded-[10px] bg-transparent px-3 text-[14px] font-normal leading-5 text-sidebar-accent-foreground hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:font-normal group-data-[collapsible=icon]:justify-center"
                  isActive={pathname === "/"}
                  onClick={handleNewChat}
                  tooltip={translate("新对话", "New chat")}
                >
                  <SquarePenIcon className="size-[19px]" />
                  <span>{translate("新对话", "New chat")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {primaryItems.map(({ href, icon: Icon, label }) => (
                <SidebarMenuItem key={label[0]}>
                  {href ? (
                    <SidebarMenuButton
                      asChild
                      className="h-10 rounded-[10px] px-3 text-[14px] font-normal leading-5 text-sidebar-accent-foreground hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:font-normal group-data-[collapsible=icon]:justify-center"
                      isActive={pathname === href}
                      tooltip={translate(label[0], label[1])}
                    >
                      <Link href={href} onClick={handleCloseMobile}>
                        <Icon className="size-[19px]" />
                        <span>{translate(label[0], label[1])}</span>
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      className="h-10 rounded-[10px] px-3 text-[14px] font-normal leading-5 text-sidebar-accent-foreground hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center"
                      data-label={translate(label[0], label[1])}
                      onClick={handleComingSoon}
                      tooltip={translate(label[0], label[1])}
                    >
                      <Icon className="size-[19px]" />
                      <span>{translate(label[0], label[1])}</span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4 px-0 group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="mb-0.5 flex h-6 items-center justify-between px-3 text-[13px] font-normal text-[var(--muted-ink-soft)]">
            <span>{translate("项目", "Projects")}</span>
            <button
              aria-label={translate("添加项目", "Add project")}
              className="grid size-7 place-items-center rounded-md transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              data-label={translate("新项目", "New project")}
              onClick={handleComingSoon}
              type="button"
            >
              <PlusIcon className="size-4" />
            </button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {workspaceItems.map(({ icon: Icon, label }) => (
                <SidebarMenuItem key={label[0]}>
                  <SidebarMenuButton
                    className="h-9 rounded-lg px-3 text-[14px] font-normal leading-5 text-sidebar-accent-foreground hover:bg-sidebar-accent"
                    data-label={translate(label[0], label[1])}
                    onClick={handleComingSoon}
                  >
                    <Icon className="size-4" />
                    <span>{translate(label[0], label[1])}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarHistory user={user} />
      </SidebarContent>

      <SidebarFooter className="px-3 py-3">
        {user ? (
          <SidebarUserNav user={user} />
        ) : (
          <Link
            className="flex h-9 items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center"
            href="/login"
          >
            <span className="grid size-7 place-items-center rounded-full bg-primary/12 text-primary">
              <UserRoundIcon className="size-4" />
            </span>
            <span className="group-data-[collapsible=icon]:hidden">
              robotbird
            </span>
          </Link>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
