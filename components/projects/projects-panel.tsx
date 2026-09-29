// biome-ignore-all lint/performance/noJsxPropsBind: small interactive project list uses row-scoped actions
"use client";

import { FolderIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import {
  formatShortDate,
  type ProjectSummary,
  request,
} from "@/components/projects/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProjectsPanel() {
  const t = useTranslations("projects");
  const router = useRouter();
  const { data, isLoading, mutate } = useSWR<{ projects: ProjectSummary[] }>(
    "/api/projects",
    request
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const projects = data?.projects ?? [];

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    try {
      await request(`/api/projects/${deleteTarget.id}`, { method: "DELETE" });
      toast.success(t("deleted", { name: deleteTarget.name }));
      mutate(
        (current) =>
          current && {
            projects: current.projects.filter(
              (project) => project.id !== deleteTarget.id
            ),
          },
        { revalidate: false }
      );
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col overflow-y-auto px-6 pb-16 pt-14 md:px-8">
      <header className="flex items-center justify-between">
        <h1 className="text-heading-lg text-foreground">{t("listTitle")}</h1>
        <Button
          className="gap-1.5"
          onClick={() => setCreateOpen(true)}
          size="sm"
          variant="outline"
        >
          <PlusIcon className="size-4" />
          {t("createAction")}
        </Button>
      </header>

      {isLoading ? (
        <div className="mt-10 space-y-2">
          {[64, 48, 56].map((width) => (
            <div
              className="h-14 animate-pulse rounded-xl bg-muted/60"
              key={width}
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <FolderIcon className="size-10 text-muted-foreground/40" />
          <p className="text-base text-muted-foreground">{t("emptyHint")}</p>
          <Button
            className="mt-1"
            onClick={() => setCreateOpen(true)}
            variant="outline"
          >
            {t("emptyAction")}
          </Button>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col">
          {projects.map((project) => (
            <li key={project.id}>
              <div className="group flex items-center gap-3 rounded-md border border-transparent px-3 py-3 transition-colors hover:bg-muted/50">
                <button
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
                  onClick={() => router.push(`/projects/${project.id}`)}
                  type="button"
                >
                  <FolderIcon className="size-5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-foreground">
                      {project.name}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {t("updatedAtLabel", {
                        date: formatShortDate(project.updatedAt),
                      })}
                    </span>
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label={t("moreActions")}
                      className="opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                      size="icon-sm"
                      variant="ghost"
                    >
                      <MoreHorizontalIcon className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem
                      onClick={() => router.push(`/projects/${project.id}`)}
                    >
                      {t("openAction")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteTarget(project)}
                    >
                      {t("deleteAction")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateProjectDialog
        onCreated={(project) => {
          mutate(
            (current) =>
              current
                ? { projects: [project, ...current.projects] }
                : { projects: [project] },
            { revalidate: false }
          );
          router.push(`/projects/${project.id}`);
        }}
        onOpenChange={setCreateOpen}
        open={createOpen}
      />

      <AlertDialog
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        open={deleteTarget !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmDescription", {
                name: deleteTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancelAction")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
            >
              {t("deleteAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
