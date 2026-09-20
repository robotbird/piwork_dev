"use client";

import {
  BadgeCheckIcon,
  BarChart3Icon,
  BookOpenTextIcon,
  BoxIcon,
  BracesIcon,
  CheckIcon,
  FileArchiveIcon,
  FileTextIcon,
  MailIcon,
  PresentationIcon,
  SearchIcon,
  SparklesIcon,
  UploadCloudIcon,
} from "lucide-react";
import {
  type ChangeEvent,
  type ComponentType,
  type MouseEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  type CatalogSkill,
  type SkillCategory,
  skillCategories,
} from "@/lib/ai/skill-catalog";
import { cn } from "@/lib/utils";

type SkillSummary = {
  description: string;
  displayName: string;
  enabled?: boolean;
  name: string;
};

type ViewMode = "discover" | "installed";
type SkillItem = CatalogSkill & { installed: boolean };

type DirectoryInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  directory?: string;
  webkitdirectory?: string;
};

const directoryInputProps: DirectoryInputProps = {
  directory: "",
  webkitdirectory: "",
};

const iconMap: Record<
  CatalogSkill["icon"],
  ComponentType<{ className?: string }>
> = {
  chart: BarChart3Icon,
  code: BracesIcon,
  document: FileTextIcon,
  mail: MailIcon,
  presentation: PresentationIcon,
  report: BookOpenTextIcon,
};

function fallbackSkill(skill: SkillSummary): CatalogSkill {
  return {
    capabilities: [
      "遵循 Skill 中定义的专业工作流程",
      "按需加载参考资料与脚本",
      "在当前项目中直接调用",
    ],
    category: "效率工具",
    description: skill.description,
    displayName: skill.displayName,
    icon: "document",
    name: skill.name,
    source: "企业自建",
    sourceType: "enterprise",
    version: "本地",
  };
}

export function SkillManager({
  catalog,
  initialSkills,
  readOnly = false,
}: {
  catalog: CatalogSkill[];
  initialSkills: SkillSummary[];
  readOnly?: boolean;
}) {
  const { t } = usePreferences();
  const endpoint = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/skills`;
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [installedSkills, setInstalledSkills] = useState(initialSkills);
  const [mode, setMode] = useState<ViewMode>(
    readOnly ? "installed" : "discover"
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"全部" | SkillCategory>("全部");
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingName, setPendingName] = useState<string | null>(null);

  const installedNames = useMemo(
    () => new Set(installedSkills.map((skill) => skill.name)),
    [installedSkills]
  );

  const items = useMemo<SkillItem[]>(() => {
    if (mode === "discover") {
      return catalog.map((skill) => ({
        ...skill,
        installed: installedNames.has(skill.name),
      }));
    }

    return installedSkills
      .filter((skill) => skill.enabled !== false)
      .map((skill) => ({
        ...(catalog.find((item) => item.name === skill.name) ??
          fallbackSkill(skill)),
        description: skill.description,
        displayName: skill.displayName,
        installed: true,
      }));
  }, [catalog, installedNames, installedSkills, mode]);

  const filteredSkills = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return items.filter((skill) => {
      const matchesCategory =
        category === "全部" || skill.category === category;
      const matchesQuery =
        !normalized ||
        [
          skill.displayName,
          t(skill.displayName),
          skill.name,
          skill.description,
          t(skill.description),
          skill.source,
          t(skill.source),
        ].some((value) => value.toLocaleLowerCase().includes(normalized));
      return matchesCategory && matchesQuery;
    });
  }, [category, items, query, t]);

  const refreshSkills = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(t("无法刷新技能列表"));
    }
    const data = (await response.json()) as { skills: SkillSummary[] };
    setInstalledSkills(data.skills);
  }, [endpoint, t]);

  const installSkill = useCallback(
    async (skill: SkillItem) => {
      setPendingName(skill.name);
      try {
        const response = await fetch(endpoint, {
          body: JSON.stringify({ catalogSkillName: skill.name }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error || t("安装失败"));
        }
        await refreshSkills();
        setSelectedSkill((current) =>
          current?.name === skill.name
            ? { ...current, installed: true }
            : current
        );
        toast.success(t("已安装「{name}」", { name: t(skill.displayName) }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("安装失败"));
      } finally {
        setPendingName(null);
      }
    },
    [endpoint, refreshSkills, t]
  );

  const uninstallSkill = useCallback(
    async (skill: SkillItem) => {
      setPendingName(skill.name);
      try {
        const response = await fetch(endpoint, {
          body: JSON.stringify({ name: skill.name }),
          headers: { "Content-Type": "application/json" },
          method: "DELETE",
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error || t("卸载失败"));
        }
        setInstalledSkills((current) =>
          current.filter((item) => item.name !== skill.name)
        );
        setSelectedSkill((current) =>
          current?.name === skill.name
            ? { ...current, installed: false }
            : current
        );
        toast.success(t("已卸载「{name}」", { name: t(skill.displayName) }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("卸载失败"));
      } finally {
        setPendingName(null);
      }
    },
    [endpoint, t]
  );

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
        setMode("installed");
        toast.success(t("技能 {name} 已上传", { name: data.name ?? "" }));
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

  const handleAction = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const skill = items.find(
        (item) => item.name === event.currentTarget.dataset.skillName
      );
      if (!skill) {
        return;
      }
      if (skill.installed) {
        uninstallSkill(skill);
      } else {
        installSkill(skill);
      }
    },
    [installSkill, items, uninstallSkill]
  );

  const selectMode = useCallback((nextMode: ViewMode) => {
    setMode(nextMode);
    setCategory("全部");
  }, []);

  const handleQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setQuery(event.currentTarget.value),
    []
  );
  const handleModeClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      selectMode(event.currentTarget.dataset.mode as ViewMode),
    [selectMode]
  );
  const handleCategoryClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      setCategory(
        event.currentTarget.dataset.category as "全部" | SkillCategory
      ),
    []
  );
  const handleOpenSkill = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const skill = items.find(
        (item) => item.name === event.currentTarget.dataset.skillName
      );
      if (skill) {
        setSelectedSkill(skill);
      }
    },
    [items]
  );
  const handleOpenUpload = useCallback(() => setUploadOpen(true), []);
  const handleDetailOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSelectedSkill(null);
    }
  }, []);
  const handleDetailAction = useCallback(() => {
    if (!selectedSkill) {
      return;
    }
    if (selectedSkill.installed) {
      uninstallSkill(selectedSkill);
    } else {
      installSkill(selectedSkill);
    }
  }, [installSkill, selectedSkill, uninstallSkill]);
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
      <section className="min-w-0 px-5 py-7 sm:px-8 lg:px-10 lg:py-9 xl:px-14">
        <div className="mx-auto max-w-[1180px]">
          <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
                  <SparklesIcon className="size-4" />
                </span>
                <h1 className="text-heading-lg text-foreground">Skill</h1>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("发现和使用各类 AI 技能，拓展团队的工作能力。")}
              </p>
            </div>
            <div className="relative w-full xl:max-w-[430px]">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label={t("搜索 Skill")}
                className="pl-10 text-sm shadow-none"
                onChange={handleQueryChange}
                placeholder={t("搜索 Skill、功能或来源")}
                value={query}
              />
            </div>
          </header>

          <div className="mt-7 flex items-end justify-between border-b border-border">
            <div
              aria-label={t("Skill 列表")}
              className="flex gap-7"
              role="tablist"
            >
              {(readOnly
                ? (["installed"] as const)
                : (["discover", "installed"] as const)
              ).map((item) => {
                const active = mode === item;
                return (
                  <button
                    aria-selected={active}
                    className={cn(
                      "relative h-11 text-[15px] font-medium transition-colors",
                      active
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    data-mode={item}
                    key={item}
                    onClick={handleModeClick}
                    role="tab"
                    type="button"
                  >
                    {item === "discover"
                      ? t("发现 Skill")
                      : readOnly
                        ? `${t("企业 Skill 列表")} ${installedSkills.length}`
                        : t("我的 Skill {count}", {
                            count: installedSkills.length,
                          })}
                    {active ? (
                      <span className="absolute inset-x-0 bottom-[-1px] h-0.5 rounded-full bg-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
            {mode === "installed" && !readOnly ? (
              <Button
                className="mb-2"
                onClick={handleOpenUpload}
                size="sm"
                variant="outline"
              >
                <UploadCloudIcon data-icon="inline-start" />
                {t("上传 Skill")}
              </Button>
            ) : null}
          </div>

          <fieldset className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <legend className="sr-only">{t("Skill 分类")}</legend>
            {skillCategories.map((item) => (
              <button
                aria-pressed={category === item}
                className={cn(
                  "h-9 shrink-0 rounded-md border px-4 text-sm transition-colors",
                  category === item
                    ? "border-primary/35 bg-primary/10 font-medium text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-[var(--hairline-strong)] hover:text-foreground"
                )}
                data-category={item}
                key={item}
                onClick={handleCategoryClick}
                type="button"
              >
                {t(item)}
              </button>
            ))}
          </fieldset>

          {filteredSkills.length > 0 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredSkills.map((skill) => (
                <SkillCard
                  key={skill.name}
                  onAction={readOnly ? undefined : handleAction}
                  onOpen={handleOpenSkill}
                  pending={pendingName === skill.name}
                  skill={skill}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--hairline-strong)] bg-card text-center">
              <span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
                <BoxIcon className="size-5" />
              </span>
              <p className="mt-4 text-sm font-medium text-foreground">
                {mode === "installed" && installedSkills.length === 0
                  ? readOnly
                    ? t("还没有企业 Skill")
                    : t("还没有安装 Skill")
                  : t("没有找到匹配的 Skill")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "installed" && installedSkills.length === 0
                  ? readOnly
                    ? t("请联系管理员上传并启用 Skill")
                    : t("去发现页挑选一个，或上传企业自建 Skill")
                  : t("试试其它关键词或分类")}
              </p>
            </div>
          )}
        </div>
      </section>

      <SkillDetailDialog
        onAction={readOnly ? undefined : handleDetailAction}
        onOpenChange={handleDetailOpenChange}
        pending={selectedSkill?.name === pendingName}
        skill={selectedSkill}
      />

      <Dialog onOpenChange={setUploadOpen} open={uploadOpen}>
        <DialogContent className="gap-5 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg text-foreground">
              {t("上传企业 Skill")}
            </DialogTitle>
            <DialogDescription>
              {t("选择完整技能文件夹或 .zip 压缩包。根目录需包含 SKILL.md。")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <UploadChoice
              disabled={uploading}
              icon={UploadCloudIcon}
              label={t("选择技能文件夹")}
              note={t("包含脚本、参考资料与资源")}
              onClick={handleBrowseFolder}
            />
            <UploadChoice
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
    </>
  );
}

function SkillCard({
  onAction,
  onOpen,
  pending,
  skill,
}: {
  onAction?: (event: MouseEvent<HTMLButtonElement>) => void;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  pending: boolean;
  skill: SkillItem;
}) {
  const Icon = iconMap[skill.icon];
  const { t } = usePreferences();
  return (
    <article className="group relative min-h-[174px] rounded-xl border border-border bg-card p-5 transition-colors hover:border-[var(--hairline-strong)]">
      <button
        aria-label={`${t("查看 {name} 详情", { name: t(skill.displayName) })}`}
        className="absolute inset-0 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/30"
        data-skill-name={skill.name}
        onClick={onOpen}
        type="button"
      />
      <div className="pointer-events-none relative flex items-start gap-3.5">
        <SkillIcon icon={Icon} name={skill.name} />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-[15px] font-medium text-foreground">
              {t(skill.displayName)}
            </h2>
            {skill.sourceType === "official" ? (
              <BadgeCheckIcon
                aria-label={t("官方认证")}
                className="size-4 shrink-0 fill-primary/10 text-primary"
              />
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {t(skill.source)}
          </p>
        </div>
      </div>
      <p className="pointer-events-none relative mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
        {t(skill.description)}
      </p>
      <div className="pointer-events-none relative mt-4 flex items-center justify-between">
        <span className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
          {t(skill.category)}
        </span>
        {onAction ? (
          <Button
            className={cn(
              "pointer-events-auto relative z-10 min-w-[76px] rounded-md",
              skill.installed
                ? "border-border bg-card text-muted-foreground hover:border-destructive/35 hover:bg-destructive/5 hover:text-destructive"
                : "bg-primary text-primary-foreground hover:bg-primary/85"
            )}
            data-skill-name={skill.name}
            disabled={pending}
            onClick={onAction}
            size="sm"
            variant={skill.installed ? "outline" : "default"}
          >
            {pending ? t("处理中…") : skill.installed ? t("已安装") : t("安装")}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function SkillIcon({
  icon: Icon,
  name,
}: {
  icon: ComponentType<{ className?: string }>;
  name: string;
}) {
  const palettes = [
    "bg-primary/10 text-primary",
    "bg-muted text-foreground",
    "bg-muted text-foreground",
    "bg-muted text-foreground",
  ];
  const palette = palettes[name.length % palettes.length];
  return (
    <span
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-xl",
        palette
      )}
    >
      <Icon className="size-[21px]" />
    </span>
  );
}

function SkillDetailDialog({
  onAction,
  onOpenChange,
  pending,
  skill,
}: {
  onAction?: () => void;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  skill: SkillItem | null;
}) {
  const Icon = skill ? iconMap[skill.icon] : FileTextIcon;
  const { t } = usePreferences();
  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(skill)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-card p-0 sm:max-w-[620px]">
        {skill ? (
          <>
            <div className="border-b border-border px-6 pb-6 pt-7 sm:px-7">
              <DialogHeader className="pr-8">
                <div className="flex items-start gap-4">
                  <SkillIcon icon={Icon} name={skill.name} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <DialogTitle className="text-xl font-medium text-foreground">
                        {t(skill.displayName)}
                      </DialogTitle>
                      {skill.sourceType === "official" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                          <BadgeCheckIcon className="size-3.5" />
                          {t("官方认证")}
                        </span>
                      ) : null}
                    </div>
                    <DialogDescription className="mt-1.5 text-sm">
                      {t("由 {source} 提供 · v{version}", {
                        source: t(skill.source),
                        version: skill.version,
                      })}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <p className="mt-5 text-sm leading-6 text-muted-foreground">
                {t(skill.description)}
              </p>
              {onAction ? (
                <Button
                  className={cn(
                    "mt-5 h-10 w-full rounded-md sm:w-32",
                    skill.installed
                      ? "border-border bg-card text-muted-foreground hover:border-destructive/35 hover:bg-destructive/5 hover:text-destructive"
                      : "bg-primary text-primary-foreground hover:bg-primary/85"
                  )}
                  disabled={pending}
                  onClick={onAction}
                  variant={skill.installed ? "outline" : "default"}
                >
                  {pending
                    ? t("处理中…")
                    : skill.installed
                      ? t("卸载 Skill")
                      : t("一键安装")}
                </Button>
              ) : null}
            </div>
            <div className="space-y-6 px-6 py-6 sm:px-7">
              <section>
                <h3 className="text-sm font-medium text-foreground">
                  {t("核心能力")}
                </h3>
                <ul className="mt-3 space-y-2.5">
                  {skill.capabilities.map((capability) => (
                    <li
                      className="flex items-start gap-2.5 text-sm leading-5 text-muted-foreground"
                      key={capability}
                    >
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-muted text-link">
                        <CheckIcon className="size-2.5" />
                      </span>
                      {t(capability)}
                    </li>
                  ))}
                </ul>
              </section>
              <section className="grid gap-3 rounded-xl border border-border bg-[var(--canvas-soft)] p-4 text-[12px] sm:grid-cols-3">
                <Meta label={t("分类")} value={t(skill.category)} />
                <Meta label={t("安装范围")} value={t("当前项目")} />
                <Meta label="Skill ID" value={skill.name} />
              </section>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-medium text-foreground">{value}</p>
    </div>
  );
}

function UploadChoice({
  disabled,
  icon: Icon,
  label,
  note,
  onClick,
}: {
  disabled: boolean;
  icon: ComponentType<{ className?: string }>;
  label: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-[var(--canvas-soft)] px-5 text-center transition-colors hover:border-[var(--hairline-strong)] hover:bg-muted disabled:pointer-events-none disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-5 text-muted-foreground" />
      <span className="mt-3 text-sm font-medium text-foreground">{label}</span>
      <span className="mt-1 text-xs text-muted-foreground">{note}</span>
    </button>
  );
}
