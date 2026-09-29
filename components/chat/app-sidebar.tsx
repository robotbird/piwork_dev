"use client";

import {
  Clock3Icon,
  FileTextIcon,
  FolderIcon,
  Grid2X2Icon,
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
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { BrandMark } from "@/components/chat/brand-mark";
import { SidebarHistory } from "@/components/chat/sidebar-history";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import {
  type ProjectSummary,
  request as projectRequest,
} from "@/components/projects/shared";
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
import { UserNav } from "@/components/user-nav";
import { cn } from "@/lib/utils";

const primaryItems = [
  { href: "/documents", icon: FileTextIcon, labelKey: "myDocuments" },
  { href: "/scheduled-tasks", icon: Clock3Icon, labelKey: "scheduledTasks" },
  { href: "/skills", icon: Grid2X2Icon, labelKey: "skills" },
];

export function AppSidebar({ user }: { user: User | undefined }) {
  const t = useTranslations("appSidebar");
  const _tp = useTranslations("projects");
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile, toggleSidebar } = useSidebar();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: projectsData, mutate: mutateProjects } = useSWR<{
    projects: ProjectSummary[];
  }>(user ? "/api/projects" : null, projectRequest, {
    revalidateOnFocus: false,
  });
  const projects = projectsData?.projects ?? [];

  const handleNewChat = useCallback(() => {
    setOpenMobile(false);
    router.push("/");
  }, [router, setOpenMobile]);

  const handleCloseMobile = useCallback(
    () => setOpenMobile(false),
    [setOpenMobile]
  );

  const handleOpenCreate = useCallback(() => setCreateOpen(true), []);

  const handleProjectCreated = useCallback(
    (project: ProjectSummary) => {
      mutateProjects();
      setOpenMobile(false);
      router.push(`/projects/${project.id}`);
    },
    [mutateProjects, router, setOpenMobile]
  );

  const handleComingSoon = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      toast.info(
        t("comingSoon", { label: event.currentTarget.dataset.label ?? "" })
      );
    },
    [t]
  );

  return (
    <Sidebar className="border-r border-sidebar-border" collapsible="icon">
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
              aria-label={t("search")}
              className="grid size-9 place-items-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              data-label={t("search")}
              onClick={handleComingSoon}
              type="button"
            >
              <SearchIcon className="size-[18px]" />
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-label={t("collapseSidebar")}
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
                {t("collapseSidebar")}
              </TooltipContent>
            </Tooltip>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label={t("openSidebar")}
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
              {t("openSidebar")}
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
                  className="h-10 rounded-[10px] bg-transparent px-3 text-[14px] leading-5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent group-data-[collapsible=icon]:justify-center [&_svg]:size-[18px]"
                  isActive={pathname === "/"}
                  onClick={handleNewChat}
                  tooltip={t("newChat")}
                >
                  <SquarePenIcon
                    className={cn(
                      "shrink-0 transition-colors",
                      pathname === "/"
                        ? "text-foreground"
                        : "text-muted-foreground group-hover/menu-button:text-foreground"
                    )}
                  />
                  <span>{t("newChat")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {primaryItems.map(({ href, icon: Icon, labelKey }) => (
                <SidebarMenuItem key={labelKey}>
                  <SidebarMenuButton
                    asChild
                    className="h-10 rounded-[10px] px-3 text-[14px] leading-5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent group-data-[collapsible=icon]:justify-center [&_svg]:size-[18px]"
                    isActive={pathname === href}
                    tooltip={t(labelKey)}
                  >
                    <Link href={href} onClick={handleCloseMobile}>
                      <Icon
                        className={cn(
                          "shrink-0 transition-colors",
                          pathname === href
                            ? "text-foreground"
                            : "text-muted-foreground group-hover/menu-button:text-foreground"
                        )}
                      />
                      <span>{t(labelKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4 px-0 group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="mb-0.5 flex h-6 items-center justify-between px-3 text-[13px] font-medium leading-5 text-muted-foreground normal-case tracking-normal">
            <span>{t("projects")}</span>
            <button
              aria-label={t("addProject")}
              className="grid size-7 place-items-center rounded-md transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={handleOpenCreate}
              type="button"
            >
              <PlusIcon className="size-4" />
            </button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {projects.map((project) => {
                const href = `/projects/${project.id}`;
                return (
                  <SidebarMenuItem key={project.id}>
                    <SidebarMenuButton
                      asChild
                      className="h-9 rounded-lg px-3 text-[14px] leading-5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent [&_svg]:size-[18px]"
                      isActive={
                        pathname === href || pathname.startsWith(`${href}/`)
                      }
                      tooltip={project.name}
                    >
                      <Link href={href} onClick={handleCloseMobile}>
                        <FolderIcon
                          className={cn(
                            "shrink-0 transition-colors",
                            pathname === href || pathname.startsWith(`${href}/`)
                              ? "text-foreground"
                              : "text-muted-foreground group-hover/menu-button:text-foreground"
                          )}
                        />
                        <span className="truncate">{project.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarHistory user={user} />
      </SidebarContent>

      <SidebarFooter className="px-3 py-3">
        {user ? (
          <UserNav area="app" user={user} />
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
      <CreateProjectDialog
        onCreated={handleProjectCreated}
        onOpenChange={setCreateOpen}
        open={createOpen}
      />
      <SidebarRail />
    </Sidebar>
  );
}
