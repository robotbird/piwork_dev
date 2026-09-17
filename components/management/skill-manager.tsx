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

export function SkillManager({
  initialSkills,
}: {
  initialSkills: SkillSummary[];
}) {
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
      throw new Error("无法刷新技能列表");
    }
    const data = (await response.json()) as { skills: SkillSummary[] };
    setSkills(data.skills);
  }, [endpoint]);

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
          throw new Error(data.error || "上传失败");
        }

        await refreshSkills();
        setUploadOpen(false);
        toast.success(`技能 ${data.name ?? ""} 已上传`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "上传失败");
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
    [endpoint, refreshSkills]
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
        throw new Error(data.error || "删除失败");
      }

      setSkills((current) =>
        current.filter((skill) => skill.name !== deleteTarget.name)
      );
      toast.success(`技能 ${deleteTarget.displayName} 已删除`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, endpoint]);

  const handleOpenUpload = useCallback(() => setUploadOpen(true), []);
  const handleQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
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

  return (
    <>
      <section className="min-w-0 px-5 py-8 sm:px-8 md:px-12 md:py-14 lg:px-16">
        <div className="mx-auto max-w-4xl">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.025em]">
                技能
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                上传和管理 Pi 项目技能
              </p>
            </div>
            <Button
              className="w-fit rounded-xl px-4"
              onClick={handleOpenUpload}
            >
              <UploadCloudIcon data-icon="inline-start" />
              上传技能
            </Button>
          </header>

          <div className="mt-10 flex items-center justify-between gap-4 border-b border-border/70 pb-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              技能
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {skills.length}
              </span>
            </div>
            <div className="relative w-full max-w-[280px]">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/65" />
              <Input
                aria-label="搜索技能"
                className="h-10 rounded-full bg-background pl-9"
                onChange={handleQueryChange}
                placeholder="搜索技能"
                value={query}
              />
            </div>
          </div>

          <div className="divide-y divide-border/60">
            {filteredSkills.map((skill) => (
              <article
                className="group flex items-center gap-4 py-5"
                data-testid={`skill-row-${skill.name}`}
                key={skill.name}
              >
                <div className="grid size-11 shrink-0 place-items-center rounded-full border border-border/70 bg-card text-muted-foreground shadow-[var(--shadow-card)]">
                  <BoxIcon className="size-[18px]" strokeWidth={1.7} />
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
                  aria-label={`删除 ${skill.displayName}`}
                  className="shrink-0 rounded-lg text-muted-foreground opacity-70 hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  data-skill-name={skill.name}
                  data-testid={`delete-skill-${skill.name}`}
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
                {skills.length === 0 ? "还没有技能" : "没有匹配的技能"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {skills.length === 0
                  ? "上传包含 SKILL.md 的技能文件夹即可开始使用"
                  : "试试其它关键词"}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <Dialog onOpenChange={setUploadOpen} open={uploadOpen}>
        <DialogContent className="gap-5 rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">上传技能</DialogTitle>
            <DialogDescription>
              选择完整技能文件夹或 .zip 压缩包。技能根目录需包含
              SKILL.md，目录名需要与其中的技能名称一致。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className={cn(
                "flex min-h-40 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/25 px-5 text-center transition-colors hover:border-foreground/25 hover:bg-muted/45",
                uploading && "pointer-events-none opacity-60"
              )}
              onClick={handleBrowseFolder}
              type="button"
            >
              <UploadCloudIcon className="size-5 text-muted-foreground" />
              <span className="mt-3 text-sm font-medium">选择技能文件夹</span>
              <span className="mt-1 text-xs text-muted-foreground">
                包含脚本、参考资料与资源
              </span>
            </button>
            <button
              className={cn(
                "flex min-h-40 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/25 px-5 text-center transition-colors hover:border-foreground/25 hover:bg-muted/45",
                uploading && "pointer-events-none opacity-60"
              )}
              onClick={handleBrowseZip}
              type="button"
            >
              <FileArchiveIcon className="size-5 text-muted-foreground" />
              <span className="mt-3 text-sm font-medium">
                选择 Skill 压缩包
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                支持 .zip，最大 15 MB
              </span>
            </button>
          </div>

          {uploading ? (
            <p className="text-center text-sm text-muted-foreground">
              正在验证并上传…
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
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>删除技能？</AlertDialogTitle>
            <AlertDialogDescription>
              将从项目中永久删除“{deleteTarget?.displayName}
              ”及其所有附加文件。此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={handleConfirmDelete}
              variant="destructive"
            >
              {deleting ? "正在删除…" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
