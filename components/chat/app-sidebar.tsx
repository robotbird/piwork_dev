"use client";

import {
  BarChart3Icon,
  CirclePlusIcon,
  Clock3Icon,
  CompassIcon,
  FileCheck2Icon,
  FileTextIcon,
  FolderIcon,
  Grid2X2Icon,
  HomeIcon,
  PanelLeftCloseIcon,
  PlusIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useCallback } from "react";
import { toast } from "sonner";
import { SidebarHistory } from "@/components/chat/sidebar-history";
import { SidebarUserNav } from "@/components/chat/sidebar-user-nav";
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
import { BrandMark } from "./brand-mark";

const primaryItems = [
  { icon: FileTextIcon, label: "我的文档" },
  { icon: Clock3Icon, label: "定时任务" },
  { href: "/skills", icon: Grid2X2Icon, label: "Skill" },
  { icon: CompassIcon, label: "探索" },
];

const workspaceItems = [
  { icon: HomeIcon, label: "我的项目" },
  { icon: BarChart3Icon, label: "经营分析" },
  { icon: FileCheck2Icon, label: "合同审核" },
  { icon: FolderIcon, label: "市场研究" },
];

export function AppSidebar({ user }: { user: User | undefined }) {
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
      toast.info(`${event.currentTarget.dataset.label}即将开放`);
    },
    []
  );

  return (
    <Sidebar className="border-r border-sidebar-border/80" collapsible="icon">
      <SidebarHeader className="px-3 pb-3 pt-4">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <Link
            className="ml-1 flex items-center gap-2.5 group-data-[collapsible=icon]:hidden"
            href="/"
            onClick={handleCloseMobile}
          >
            <BrandMark className="size-10 shrink-0 shadow-[0_6px_16px_-8px_rgba(47,119,255,.9)]" />
            <span className="text-[19px] font-semibold tracking-[-0.03em] text-[#1c2738] dark:text-sidebar-foreground">
              piwork
            </span>
          </Link>
          <button
            aria-label="收起侧边栏"
            className="grid size-8 place-items-center rounded-lg text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={toggleSidebar}
            type="button"
          >
            <PanelLeftCloseIcon className="size-[18px]" />
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 pt-1">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="h-10 rounded-xl bg-[#e7f0ff] px-3 font-medium text-[#2878f0] hover:bg-[#dceaff] hover:text-[#176be3] data-[active=true]:bg-[#e7f0ff] group-data-[collapsible=icon]:justify-center dark:bg-[#1f1f1f] dark:text-[#ececec] dark:hover:bg-[#2a2a2a] dark:hover:text-white dark:data-[active=true]:bg-[#1f1f1f]"
                  isActive
                  onClick={handleNewChat}
                  tooltip="新对话"
                >
                  <CirclePlusIcon className="size-5" />
                  <span>新对话</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {primaryItems.map(({ href, icon: Icon, label }) => (
                <SidebarMenuItem key={label}>
                  {href ? (
                    <SidebarMenuButton
                      asChild
                      className="h-10 rounded-xl px-3 text-[14px] text-[#344054] hover:bg-sidebar-accent/70 hover:text-[#1c2738] data-[active=true]:bg-[#edf3fc] data-[active=true]:font-medium data-[active=true]:text-[#216ff4] group-data-[collapsible=icon]:justify-center dark:text-[#d1d1d1] dark:hover:bg-[#1f1f1f] dark:hover:text-white"
                      isActive={pathname === href}
                      tooltip={label}
                    >
                      <Link href={href} onClick={handleCloseMobile}>
                        <Icon className="size-[19px]" strokeWidth={1.7} />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      className="h-10 rounded-xl px-3 text-[14px] text-[#344054] hover:bg-sidebar-accent/70 hover:text-[#1c2738] group-data-[collapsible=icon]:justify-center dark:text-[#d1d1d1] dark:hover:bg-[#1f1f1f] dark:hover:text-white"
                      data-label={label}
                      onClick={handleComingSoon}
                      tooltip={label}
                    >
                      <Icon className="size-[19px]" strokeWidth={1.7} />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-2 border-t border-sidebar-border/70 px-0 pt-3 group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="mb-1 flex h-7 items-center justify-between px-3 text-[13px] font-normal text-sidebar-foreground/50">
            <span>项目</span>
            <button
              aria-label="添加项目"
              className="grid size-7 place-items-center rounded-md transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              data-label="新项目"
              onClick={handleComingSoon}
              type="button"
            >
              <PlusIcon className="size-4" />
            </button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {workspaceItems.map(({ icon: Icon, label }) => (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton
                    className="h-9 rounded-lg px-3 text-[14px] text-[#344054] hover:bg-sidebar-accent/70 hover:text-[#1c2738] dark:text-[#d1d1d1] dark:hover:bg-[#1f1f1f] dark:hover:text-white"
                    data-label={label}
                    onClick={handleComingSoon}
                  >
                    <Icon className="size-[18px]" strokeWidth={1.65} />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarHistory user={user} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/70 px-3 py-3">
        {user ? (
          <SidebarUserNav user={user} />
        ) : (
          <Link
            className="flex h-9 items-center gap-2 rounded-lg px-2 text-[13px] text-sidebar-foreground/75 hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center"
            href="/login"
          >
            <span className="grid size-7 place-items-center rounded-full bg-[#8db8e0] text-white">
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
