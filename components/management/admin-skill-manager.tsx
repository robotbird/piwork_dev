"use client";

import {
  BookOpenTextIcon,
  BoxIcon,
  FileArchiveIcon,
  MoreHorizontalIcon,
  SearchIcon,
  Trash2Icon,
  UploadCloudIcon,
} from "lucide-react";
import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  type SkillBrowseTarget,
  SkillContentBrowser,
} from "@/components/management/skill-content-browser";
import { usePreferences } from "@/components/preferences-provider";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type SkillSummary = {
  description: string;
  displayName: string;
  enabled: boolean;
  name: string;
  source: "catalog" | "pi-package" | "upload";
  version: string;
};

type StatusFilter = "all" | "enabled" | "disabled";

type DirectoryInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  directory?: string;
  webkitdirectory?: string;
};

const directoryInputProps: DirectoryInputProps = {
  directory: "",
  webkitdirectory: "",
};

export function AdminSkillManager({
  initialSkills,
}: {
  initialSkills: SkillSummary[];
}) {
  const { t } = usePreferences();
  const endpoint = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/admin/skills`;
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [skills, setSkills] = useState(initialSkills);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SkillSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingName, setTogglingName] = useState<string | null>(null);
  const [browseTarget, setBrowseTarget] = useState<SkillBrowseTarget | null>(
    null
  );

  const counts = useMemo(
    () => ({
      all: skills.length,
      disabled: skills.filter((skill) => !skill.enabled).length,
      enabled: skills.filter((skill) => skill.enabled).length,
    }),
    [skills]
  );

  const filteredSkills = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return skills.filter((skill) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "enabled" ? skill.enabled : !skill.enabled);
      const matchesQuery =
        !normalized ||
        [t(skill.displayName), skill.name, t(skill.description)].some((value) =>
          value.toLocaleLowerCase().includes(normalized)
        );
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, skills, t]);

  const refreshSkills = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(t("skills.failedToRefreshTheSkillList"));
    }
    const data = (await response.json()) as { skills: SkillSummary[] };
    setSkills(data.skills);
  }, [endpoint, t]);

  const uploadFiles = useCallback(
    async (selectedFiles: File[]) => {
      if (selectedFiles.length === 0) {
        return;
      }
      setUploading(true);
      try {
        const formData = new FormData();
        for (const file of selectedFiles) {
          formData.append("files", file);
          formData.append("paths", file.webkitRelativePath || file.name);
        }
        const response = await fetch(endpoint, {
          body: formData,
          method: "POST",
        });
        const data = (await response.json()) as {
          error?: string;
          name?: string;
        };
        if (!response.ok) {
          throw new Error(data.error || t("skills.uploadFailed"));
        }
        await refreshSkills();
        setUploadOpen(false);
        toast.success(t("skills.skillUploaded", { name: data.name ?? "" }));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("skills.uploadFailed")
        );
      } finally {
        setUploading(false);
        if (folderInputRef.current) {
          folderInputRef.current.value = "";
        }
        if (zipInputRef.current) {
          zipInputRef.current.value = "";
        }
      }
    },
    [endpoint, refreshSkills, t]
  );

  const toggleSkill = useCallback(
    async (skill: SkillSummary) => {
      setTogglingName(skill.name);
      try {
        const response = await fetch(endpoint, {
          body: JSON.stringify({ enabled: !skill.enabled, name: skill.name }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error || t("skills.actionFailed"));
        }
        setSkills((current) =>
          current.map((item) =>
            item.name === skill.name
              ? { ...item, enabled: !skill.enabled }
              : item
          )
        );
        toast.success(
          skill.enabled
            ? t("common.disabled", { name: skill.displayName })
            : t("common.enabledWithName", { name: skill.displayName })
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("skills.actionFailed")
        );
      } finally {
        setTogglingName(null);
      }
    },
    [endpoint, t]
  );

  const deleteSkill = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    try {
      const response = await fetch(endpoint, {
        body: JSON.stringify({ name: deleteTarget.name }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || t("skills.deleteFailed"));
      }
      setSkills((current) =>
        current.filter((skill) => skill.name !== deleteTarget.name)
      );
      toast.success(
        t("skills.skillDeleted", { name: deleteTarget.displayName })
      );
      setDeleteTarget(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("skills.deleteFailed")
      );
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, endpoint, t]);

  const handleQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setQuery(event.currentTarget.value),
    []
  );
  const handleFilterClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      setFilter(event.currentTarget.dataset.filter as StatusFilter),
    []
  );
  const handleToggleRequest = useCallback(
    (skillName: string) => {
      const skill = skills.find((candidate) => candidate.name === skillName);
      if (skill) {
        toggleSkill(skill);
      }
    },
    [skills, toggleSkill]
  );
  const handleBrowseRequest = useCallback(
    (skillName: string) => {
      const skill = skills.find((candidate) => candidate.name === skillName);
      if (skill) {
        setBrowseTarget({
          description: skill.description,
          displayName: skill.displayName,
          name: skill.name,
          source: skill.source,
          version: skill.version,
        });
      }
    },
    [skills]
  );
  const handleDeleteRequest = useCallback(
    (skillName: string) => {
      const skill = skills.find((candidate) => candidate.name === skillName);
      if (skill) {
        setDeleteTarget(skill);
      }
    },
    [skills]
  );
  const handleDeleteDialogChange = useCallback(
    (open: boolean) => {
      if (!open && !deleting) {
        setDeleteTarget(null);
      }
    },
    [deleting]
  );
  const handleConfirmDelete = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      deleteSkill();
    },
    [deleteSkill]
  );
  const handleBrowserOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setBrowseTarget(null);
    }
  }, []);
  const handleOpenUpload = useCallback(() => setUploadOpen(true), []);
  const handleBrowseFolder = useCallback(
    () => folderInputRef.current?.click(),
    []
  );
  const handleBrowseZip = useCallback(() => zipInputRef.current?.click(), []);
  const handleFolderChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      uploadFiles(Array.from(event.currentTarget.files ?? [])),
    [uploadFiles]
  );
  const handleZipChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      uploadFiles(Array.from(event.currentTarget.files ?? [])),
    [uploadFiles]
  );

  const filterTabs: Array<{ count: number; key: StatusFilter; label: string }> =
    [
      { count: counts.all, key: "all", label: t("skills.all") },
      { count: counts.enabled, key: "enabled", label: t("common.enabled") },
      { count: counts.disabled, key: "disabled", label: t("skills.disabled") },
    ];

  return (
    <>
      <section className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-12 lg:py-16">
        <div className="mx-auto max-w-[960px]">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.025em]">
                {t("skills.enterpriseSkills")}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {t("skills.uploadSearchAndManageEnterpriseSkillsAvailable")}
              </p>
            </div>
            <Button className="w-fit px-4" onClick={handleOpenUpload}>
              <UploadCloudIcon data-icon="inline-start" />
              {t("skills.uploadSkill")}
            </Button>
          </header>

          <div className="mt-9 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div
              aria-label={t("skills.skillList")}
              className="flex gap-6"
              role="tablist"
            >
              {filterTabs.map((tab) => {
                const active = filter === tab.key;
                return (
                  <button
                    aria-selected={active}
                    className={cn(
                      "relative flex h-9 items-center gap-1.5 text-[15px] font-medium transition-colors",
                      active
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    data-filter={tab.key}
                    key={tab.key}
                    onClick={handleFilterClick}
                    role="tab"
                    type="button"
                  >
                    {tab.label}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                      {tab.count}
                    </span>
                    {active ? (
                      <span className="absolute inset-x-0 -bottom-[17px] h-0.5 rounded-full bg-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="relative w-full sm:max-w-[280px]">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/65" />
              <Input
                aria-label={t("skills.searchEnterpriseSkills")}
                className="pl-9"
                onChange={handleQueryChange}
                placeholder={t("skills.searchSkills")}
                type="search"
                value={query}
              />
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-[14px] border border-border bg-card">
            <div className="overflow-x-auto">
              <table
                aria-label={t("skills.enterpriseSkillList")}
                className="w-full min-w-[760px] text-left text-sm"
              >
                <thead className="bg-muted/50 text-[13px] text-muted-foreground">
                  <tr>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {t("skills.skill")}
                    </th>
                    <th className="h-10 w-24 px-4 font-medium" scope="col">
                      {t("skills.version")}
                    </th>
                    <th className="h-10 w-24 px-4 font-medium" scope="col">
                      {t("skills.source")}
                    </th>
                    <th className="h-10 w-28 px-4 font-medium" scope="col">
                      {t("common.status")}
                    </th>
                    <th
                      className="h-10 w-14 px-4 text-right font-medium"
                      scope="col"
                    >
                      {t("common.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSkills.length > 0 ? (
                    filteredSkills.map((skill) => (
                      <SkillRow
                        key={skill.name}
                        onBrowse={handleBrowseRequest}
                        onDelete={handleDeleteRequest}
                        onToggle={handleToggleRequest}
                        skill={skill}
                        toggling={togglingName === skill.name}
                      />
                    ))
                  ) : (
                    <tr className="border-t border-border/70">
                      <td
                        className="px-4 py-10 text-center text-sm text-muted-foreground"
                        colSpan={5}
                      >
                        {skills.length === 0
                          ? t("skills.noEnterpriseSkillsYet")
                          : t("skills.noMatchingSkills")}
                        <span className="mt-1 block text-[13px]">
                          {skills.length === 0
                            ? t("skills.uploadAFolderContainingSkillMdTo")
                            : t("skills.tryAnotherSearchTerm")}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <SkillContentBrowser
        onOpenChange={handleBrowserOpenChange}
        skill={browseTarget}
      />

      <Dialog onOpenChange={setUploadOpen} open={uploadOpen}>
        <DialogContent className="gap-5 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {t("skills.uploadEnterpriseSkill")}
            </DialogTitle>
            <DialogDescription>
              {t("skills.chooseACompleteSkillFolderOrZip")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <UploadOption
              disabled={uploading}
              icon={UploadCloudIcon}
              label={t("skills.chooseSkillFolder")}
              note={t("skills.includesScriptsReferencesAndAssets")}
              onClick={handleBrowseFolder}
            />
            <UploadOption
              disabled={uploading}
              icon={FileArchiveIcon}
              label={t("skills.chooseSkillArchive")}
              note={t("skills.supportsZipUpTo15Mb")}
              onClick={handleBrowseZip}
            />
          </div>
          {uploading ? (
            <p className="text-center text-sm text-muted-foreground">
              {t("skills.validatingAndUploading")}
            </p>
          ) : null}
          <input
            {...directoryInputProps}
            className="hidden"
            multiple
            onChange={handleFolderChange}
            ref={folderInputRef}
            type="file"
          />
          <input
            accept=".zip,application/zip"
            className="hidden"
            onChange={handleZipChange}
            ref={zipInputRef}
            type="file"
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        onOpenChange={handleDeleteDialogChange}
        open={Boolean(deleteTarget)}
      >
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("skills.confirmDeleteEnterpriseSkill")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("skills.thisWillPermanentlyRemoveAndAllAttached", {
                name: deleteTarget?.displayName ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={handleConfirmDelete}
              variant="destructive"
            >
              {deleting ? t("skills.deleting") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SkillRow({
  onBrowse,
  onDelete,
  onToggle,
  skill,
  toggling,
}: {
  onBrowse: (skillName: string) => void;
  onDelete: (skillName: string) => void;
  onToggle: (skillName: string) => void;
  skill: SkillSummary;
  toggling: boolean;
}) {
  const { t } = usePreferences();
  const handleBrowse = useCallback(
    () => onBrowse(skill.name),
    [onBrowse, skill.name]
  );
  const handleDelete = useCallback(
    () => onDelete(skill.name),
    [onDelete, skill.name]
  );
  const handleToggle = useCallback(
    () => onToggle(skill.name),
    [onToggle, skill.name]
  );

  return (
    <tr className="border-t border-border/70 align-middle transition-colors hover:bg-muted/30">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card",
              skill.enabled ? "text-primary" : "text-muted-foreground"
            )}
          >
            <BoxIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <button
                className={cn(
                  "truncate text-[14px] leading-5 font-medium hover:underline",
                  skill.enabled ? "text-link" : "text-muted-foreground"
                )}
                onClick={handleBrowse}
                type="button"
              >
                {t(skill.displayName)}
              </button>
              <span className="hidden shrink-0 rounded-md bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
                /{skill.name}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-1 text-[13px] leading-5 text-muted-foreground">
              {t(skill.description)}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5 whitespace-nowrap">
        {skill.version ? (
          <span className="font-mono text-[13px] text-muted-foreground">
            v{skill.version}
          </span>
        ) : (
          <span className="text-[13px] text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3.5 whitespace-nowrap text-[13px] text-muted-foreground">
        {skill.source === "catalog"
          ? t("skills.officialCatalog")
          : skill.source === "pi-package"
            ? t("skills.piPackage")
            : t("skills.uploaded")}
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <Switch
            aria-label={t("skills.enableOrDisable", {
              name: t(skill.displayName),
            })}
            checked={skill.enabled}
            disabled={toggling}
            onCheckedChange={handleToggle}
          />
          <span
            className={cn(
              "text-[13px] leading-5 whitespace-nowrap",
              skill.enabled ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {skill.enabled ? t("common.enabled") : t("skills.disabled")}
          </span>
        </div>
      </td>
      <td className="px-4 py-3.5 text-right">
        <DropdownMenu modal>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={t("common.moreActions")}
              className="text-muted-foreground data-[state=open]:bg-muted hover:text-foreground"
              size="icon-sm"
              variant="ghost"
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom">
            <DropdownMenuItem className="cursor-pointer" onClick={handleBrowse}>
              <BookOpenTextIcon />
              <span>{t("skills.browseFiles")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={handleDelete}
              variant="destructive"
            >
              <Trash2Icon />
              <span>{t("common.delete")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function UploadOption({
  disabled,
  icon: Icon,
  label,
  note,
  onClick,
}: {
  disabled: boolean;
  icon: typeof UploadCloudIcon;
  label: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex min-h-40 w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/25 px-5 text-center transition-colors hover:border-[var(--hairline-strong)] hover:bg-muted/45",
        disabled && "pointer-events-none opacity-60"
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-5 text-muted-foreground" />
      <span className="mt-3 text-sm font-medium">{label}</span>
      <span className="mt-1 text-xs text-muted-foreground">{note}</span>
    </button>
  );
}
