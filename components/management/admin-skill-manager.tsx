"use client";

import {
  BoxIcon,
  FileArchiveIcon,
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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/preferences-provider";

type SkillSummary = {
  description: string;
  displayName: string;
  name: string;
};

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
  const endpoint = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/skills`;
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [skills, setSkills] = useState(initialSkills);
  const [query, setQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SkillSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredSkills = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) {
      return skills;
    }
    return skills.filter((skill) =>
      [skill.displayName, skill.name, skill.description].some((value) =>
        value.toLocaleLowerCase().includes(normalized)
      )
    );
  }, [query, skills]);

  const refreshSkills = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(t("无法刷新 Skill 列表"));
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
          throw new Error(data.error || t("上传失败"));
        }
        await refreshSkills();
        setUploadOpen(false);
        toast.success(t("Skill {name} 已上传", { name: data.name ?? "" }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("上传失败"));
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
        throw new Error(data.error || t("删除失败"));
      }
      setSkills((current) =>
        current.filter((skill) => skill.name !== deleteTarget.name)
      );
      toast.success(
        t("Skill「{name}」已删除", { name: deleteTarget.displayName })
      );
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("删除失败"));
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, endpoint, t]);

  const handleQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setQuery(event.currentTarget.value),
    []
  );
  const handleDeleteRequest = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const skill = skills.find(
        (candidate) => candidate.name === event.currentTarget.dataset.skillName
      );
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

  return (
    <>
      <section className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-12 lg:py-16">
        <div className="mx-auto max-w-[960px]">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.025em]">
                {t("企业 Skill 库")}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {t("上传、检索和管理当前 Pi 项目可用的企业 Skill")}
              </p>
            </div>
            <Button className="w-fit px-4" onClick={handleOpenUpload}>
              <UploadCloudIcon data-icon="inline-start" />
              {t("上传 Skill")}
            </Button>
          </header>

          <div className="mt-9 flex flex-col items-stretch gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-2 whitespace-nowrap text-sm font-medium">
              {t("已上架 Skill")}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {skills.length}
              </span>
            </div>
            <div className="relative w-full sm:max-w-[280px]">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/65" />
              <Input
                aria-label={t("搜索企业 Skill")}
                className="pl-9"
                onChange={handleQueryChange}
                placeholder={t("搜索 Skill")}
                value={query}
              />
            </div>
          </div>

          <div className="divide-y divide-border/60">
            {filteredSkills.map((skill) => (
              <article
                className="group flex items-center gap-4 py-5"
                key={skill.name}
              >
                <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-primary">
                  <BoxIcon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-[15px] font-medium">
                      {skill.displayName}
                    </h2>
                    <span className="hidden shrink-0 rounded-md bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
                      /{skill.name}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                    {skill.description}
                  </p>
                </div>
                <Button
                  aria-label={t("删除 {name}", { name: skill.displayName })}
                  className="shrink-0 rounded-md text-muted-foreground opacity-70 hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  data-skill-name={skill.name}
                  onClick={handleDeleteRequest}
                  size="icon-sm"
                  variant="ghost"
                >
                  <Trash2Icon />
                </Button>
              </article>
            ))}
          </div>

          {filteredSkills.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                <BoxIcon className="size-5" />
              </div>
              <p className="mt-4 text-sm font-medium">
                {skills.length === 0
                  ? t("还没有企业 Skill")
                  : t("没有匹配的 Skill")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {skills.length === 0
                  ? t("上传包含 SKILL.md 的文件夹即可上架")
                  : t("试试其它关键词")}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <Dialog onOpenChange={setUploadOpen} open={uploadOpen}>
        <DialogContent className="gap-5 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">{t("上传企业 Skill")}</DialogTitle>
            <DialogDescription>
              {t("选择完整 Skill 文件夹或 .zip 压缩包。根目录需包含 SKILL.md。")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <UploadOption
              disabled={uploading}
              icon={UploadCloudIcon}
              label={t("选择 Skill 文件夹")}
              note={t("包含脚本、参考资料与资源")}
              onClick={handleBrowseFolder}
            />
            <UploadOption
              disabled={uploading}
              icon={FileArchiveIcon}
              label={t("选择 Skill 压缩包")}
              note={t("支持 .zip，最大 15 MB")}
              onClick={handleBrowseZip}
            />
          </div>
          {uploading ? (
            <p className="text-center text-sm text-muted-foreground">
              {t("正在验证并上传…")}
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
            <AlertDialogTitle>{t("删除企业 Skill？")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("将从项目中永久删除“{name}”及其所有附加文件。", {
                name: deleteTarget?.displayName ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("取消")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={handleConfirmDelete}
              variant="destructive"
            >
              {deleting ? t("正在删除…") : t("删除")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
