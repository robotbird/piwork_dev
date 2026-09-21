"use client";

import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  ModelDialog,
  type ModelFormValues,
} from "@/components/management/models/model-dialog";
import {
  ProviderDialog,
  type ProviderFormValues,
} from "@/components/management/models/provider-dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import {
  formatStamp,
  getProviderInitial,
  getProviderTone,
  MODEL_TYPE_LABELS,
  maskApiKey,
  PROVIDER_PROTOCOL_LABELS,
  type ProviderDetailView,
  type ProviderModelItem,
} from "@/lib/management/models";
import { cn } from "@/lib/utils";

async function requestJson(
  url: string,
  init: RequestInit
): Promise<{ data?: unknown; error?: string }> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!response.ok) {
      return { error: body?.error ?? "操作失败，请稍后重试" };
    }
    return { data: body };
  } catch {
    return { error: "网络异常，请稍后重试" };
  }
}

function StatusDot({ enabled }: { enabled: boolean }) {
  const { translate } = usePreferences();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] leading-5",
        enabled ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          enabled ? "bg-link" : "bg-destructive/70"
        )}
      />
      {enabled
        ? translate("已启用", "Enabled")
        : translate("已停用", "Disabled")}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const { translate } = usePreferences();
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(translate("已复制到剪贴板", "Copied to clipboard"));
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(translate("复制失败", "Copy failed"));
    }
  }, [translate, value]);

  return (
    <button
      aria-label={translate("复制", "Copy")}
      className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      onClick={handleClick}
      type="button"
    >
      {copied ? (
        <CheckIcon className="size-3.5" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </button>
  );
}

/** 基本配置卡片的单行定义 */
function ConfigRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-4 border-t border-border/60 px-4 py-3 first:border-t-0 sm:grid-cols-[160px_minmax(0,1fr)] sm:px-5">
      <dt className="text-[13px] leading-6 text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-[14px] leading-6 text-foreground">
        {children}
      </dd>
    </div>
  );
}

type ModelRowProps = {
  model: ProviderModelItem;
  onDeleteRequest: (model: ProviderModelItem) => void;
  onEdit: (model: ProviderModelItem) => void;
  onSetDefault: (model: ProviderModelItem) => void;
  onTest: (model: ProviderModelItem) => void;
  onToggleEnabled: (model: ProviderModelItem) => void;
  testing: boolean;
};

function ModelRow({
  model,
  onDeleteRequest,
  onEdit,
  onSetDefault,
  onTest,
  onToggleEnabled,
  testing,
}: ModelRowProps) {
  const intl = useTranslations("management");
  const { translate } = usePreferences();

  const handleTestClick = useCallback(() => onTest(model), [model, onTest]);
  const handleEditClick = useCallback(() => onEdit(model), [model, onEdit]);
  const handleSetDefaultClick = useCallback(
    () => onSetDefault(model),
    [model, onSetDefault]
  );
  const handleToggleClick = useCallback(
    () => onToggleEnabled(model),
    [model, onToggleEnabled]
  );
  const handleDeleteClick = useCallback(
    () => onDeleteRequest(model),
    [model, onDeleteRequest]
  );

  return (
    <tr className="border-t border-border/70 align-middle">
      <td className="px-4 py-3 text-[14px] leading-5 font-medium text-foreground">
        {model.name}
      </td>
      <td className="px-4 py-3 font-mono text-[13px] leading-5 whitespace-nowrap text-muted-foreground">
        {model.modelId}
      </td>
      <td className="px-4 py-3 text-[13px] leading-5 whitespace-nowrap text-muted-foreground">
        {translate(
          MODEL_TYPE_LABELS[model.type],
          model.type === "chat" ? "Chat" : "Multimodal"
        )}
      </td>
      <td className="px-4 py-3">
        <StatusDot enabled={model.enabled} />
      </td>
      <td className="px-4 py-3">
        {model.isDefault ? (
          <span className="inline-flex items-center rounded-full bg-link-soft px-2 py-0.5 text-xs leading-4 font-medium text-link-deep">
            {translate("默认", "Default")}
          </span>
        ) : (
          <span className="text-[13px] leading-5 text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-[13px] leading-5 whitespace-nowrap text-muted-foreground tabular-nums">
        {formatStamp(model.createdAt)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <Button
            aria-label={intl("testModelAction", { name: model.name })}
            disabled={testing}
            onClick={handleTestClick}
            size="xs"
            variant="ghost"
          >
            {testing ? <Spinner className="size-3" /> : null}
            {translate("测试", "Test")}
          </Button>
          <Button
            aria-label={intl("editModelAction", { name: model.name })}
            onClick={handleEditClick}
            size="xs"
            variant="ghost"
          >
            {translate("编辑", "Edit")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={intl("modelMoreActions", { name: model.name })}
              asChild
            >
              <Button
                className="size-6 text-muted-foreground hover:text-foreground"
                size="icon-xs"
                variant="ghost"
              >
                <MoreHorizontalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              {model.isDefault ? null : (
                <DropdownMenuItem onClick={handleSetDefaultClick}>
                  <StarIcon />
                  {translate("设为默认", "Set as default")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleToggleClick}>
                {model.enabled
                  ? translate("停用模型", "Disable model")
                  : translate("启用模型", "Enable model")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDeleteClick}
                variant="destructive"
              >
                <Trash2Icon />
                {translate("删除模型", "Delete model")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}

export function ProviderDetailPage({
  initialData,
}: {
  initialData: ProviderDetailView;
}) {
  const intl = useTranslations("management");
  const { translate } = usePreferences();
  const [detail, setDetail] = useState<ProviderDetailView>(initialData);
  const [loadFailed, setLoadFailed] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createModelOpen, setCreateModelOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ProviderModelItem | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<ProviderModelItem | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const applyView = useCallback((view: unknown) => {
    if (view && typeof view === "object" && "models" in view) {
      setDetail(view as ProviderDetailView);
      setLoadFailed(false);
      return true;
    }
    return false;
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`/api/management/models/${detail.id}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("failed to load provider");
      }
      applyView(await response.json());
    } catch {
      setLoadFailed(true);
    }
  }, [applyView, detail.id]);

  const handleRetry = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const handleEditOpen = useCallback(() => setEditOpen(true), []);
  const handleEditClose = useCallback(() => setEditOpen(false), []);

  const handleProviderSubmit = useCallback(
    async (values: ProviderFormValues) => {
      const { data, error } = await requestJson(
        `/api/management/models/${detail.id}`,
        {
          body: JSON.stringify({
            ...(values.apiKey ? { apiKey: values.apiKey } : {}),
            ...(values.baseUrl ? { baseUrl: values.baseUrl } : {}),
            description: values.description,
            enabled: values.enabled,
            name: values.name,
          }),
          method: "PATCH",
        }
      );
      if (error) {
        toast.error(translate(error, error));
        return;
      }
      if (applyView(data)) {
        setEditOpen(false);
        toast.success(intl("providerUpdated", { name: values.name }));
      }
    },
    [applyView, detail.id, intl, translate]
  );

  const handleModelDialogClose = useCallback(() => {
    setCreateModelOpen(false);
    setEditingModel(null);
  }, []);

  const handleCreateModelOpen = useCallback(() => setCreateModelOpen(true), []);

  const handleModelEditRequest = useCallback((model: ProviderModelItem) => {
    setEditingModel(model);
  }, []);

  const handleCreateModelSubmit = useCallback(
    async (values: ModelFormValues) => {
      const { data, error } = await requestJson(
        `/api/management/models/${detail.id}/models`,
        {
          body: JSON.stringify(values),
          method: "POST",
        }
      );
      if (error) {
        toast.error(translate(error, error));
        return;
      }
      if (applyView(data)) {
        setCreateModelOpen(false);
        toast.success(intl("modelCreated", { name: values.name }));
      }
    },
    [applyView, detail.id, intl, translate]
  );

  const handleModelUpdateSubmit = useCallback(
    async (values: ModelFormValues) => {
      if (!editingModel) {
        return;
      }
      const { data, error } = await requestJson(
        `/api/management/models/${detail.id}/models`,
        {
          body: JSON.stringify({ id: editingModel.id, ...values }),
          method: "PATCH",
        }
      );
      if (error) {
        toast.error(translate(error, error));
        return;
      }
      if (applyView(data)) {
        setEditingModel(null);
        toast.success(intl("modelUpdated", { name: values.name }));
      }
    },
    [applyView, detail.id, editingModel, intl, translate]
  );

  const handleToggleEnabled = useCallback(
    async (model: ProviderModelItem) => {
      const { data, error } = await requestJson(
        `/api/management/models/${detail.id}/models`,
        {
          body: JSON.stringify({ enabled: !model.enabled, id: model.id }),
          method: "PATCH",
        }
      );
      if (error) {
        toast.error(translate(error, error));
        return;
      }
      if (applyView(data)) {
        toast.success(
          model.enabled
            ? intl("modelDisabled", { name: model.name })
            : intl("modelEnabled", { name: model.name })
        );
        if (model.isDefault && model.enabled) {
          toast.info(
            translate(
              "原默认模型已停用，默认标记已取消",
              "The default model was disabled and its default flag cleared"
            )
          );
        }
      }
    },
    [applyView, detail.id, intl, translate]
  );

  const handleSetDefault = useCallback(
    async (model: ProviderModelItem) => {
      const { data, error } = await requestJson(
        `/api/management/models/${detail.id}/models`,
        {
          body: JSON.stringify({ id: model.id, isDefault: true }),
          method: "PATCH",
        }
      );
      if (error) {
        toast.error(translate(error, error));
        return;
      }
      if (applyView(data)) {
        toast.success(intl("defaultModelSet", { name: model.name }));
      }
    },
    [applyView, detail.id, intl, translate]
  );

  const handleTest = useCallback(
    async (model: ProviderModelItem) => {
      if (testingId) {
        return;
      }
      setTestingId(model.id);
      const { data, error } = await requestJson(
        `/api/management/models/${detail.id}/test`,
        {
          body: JSON.stringify({ id: model.id }),
          method: "POST",
        }
      );
      setTestingId(null);
      if (error) {
        toast.error(translate(error, error));
        return;
      }
      const result = data as
        | { error?: string; latencyMs?: number; ok: boolean; reply?: string }
        | undefined;
      if (!result) {
        return;
      }
      if (result.ok) {
        toast.success(
          intl("testSucceeded", {
            latency: result.latencyMs ?? 0,
            name: model.name,
          })
        );
      } else {
        toast.error(
          intl("testFailed", {
            name: model.name,
            reason: result.error ?? translate("未知错误", "Unknown error"),
          })
        );
      }
    },
    [detail.id, intl, testingId, translate]
  );

  const handleDeleteRequest = useCallback((model: ProviderModelItem) => {
    setDeleteTarget(model);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget || deleting) {
      return;
    }
    const target = deleteTarget;
    setDeleting(true);
    const { data, error } = await requestJson(
      `/api/management/models/${detail.id}/models`,
      {
        body: JSON.stringify({ id: target.id }),
        method: "DELETE",
      }
    );
    setDeleting(false);
    if (error) {
      toast.error(translate(error, error));
      setDeleteTarget(null);
      return;
    }
    if (applyView(data)) {
      setDeleteTarget(null);
      toast.success(intl("modelDeleted", { name: target.name }));
    }
  }, [applyView, deleteTarget, deleting, detail.id, intl, translate]);

  const handleDeleteActionClick = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      // 阻止 AlertDialog 自动关闭，删除完成后再由状态驱动关闭
      event.preventDefault();
      await handleDeleteConfirm();
    },
    [handleDeleteConfirm]
  );

  const handleDeleteDialogChange = useCallback((open: boolean) => {
    if (!open) {
      setDeleteTarget(null);
    }
  }, []);

  const handleApiKeyVisibilityToggle = useCallback(
    () => setApiKeyVisible((visible) => !visible),
    []
  );

  const providerSummary = {
    createdAt: detail.createdAt,
    description: detail.description,
    enabled: detail.enabled,
    id: detail.id,
    modelCount: detail.models.length,
    name: detail.name,
    protocol: detail.protocol,
  };

  return (
    <>
      <section className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-12 lg:px-12 lg:py-14">
        <div className="mx-auto max-w-[960px]">
          <nav aria-label={translate("面包屑", "Breadcrumb")}>
            <ol className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <li>
                <Link
                  className="inline-flex items-center gap-1 rounded-[6px] outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-[var(--hairline-strong)]"
                  href="/management/models"
                >
                  <ArrowLeftIcon className="size-3.5" />
                  {translate("模型管理", "Model management")}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="max-w-[280px] truncate text-foreground">
                {detail.name}
              </li>
            </ol>
          </nav>

          <header className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-12 shrink-0 place-items-center rounded-[12px] text-lg font-semibold",
                  getProviderTone(detail.name)
                )}
              >
                {getProviderInitial(detail.name)}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-semibold tracking-[-0.025em]">
                    {detail.name}
                  </h1>
                  {detail.enabled ? (
                    <span className="inline-flex items-center rounded-full bg-link-soft px-2 py-0.5 text-xs leading-4 font-medium text-link-deep">
                      {translate("已启用", "Enabled")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs leading-4 font-medium text-muted-foreground">
                      {translate("已停用", "Disabled")}
                    </span>
                  )}
                </div>
                {detail.description ? (
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    {detail.description}
                  </p>
                ) : null}
              </div>
            </div>
            <Button
              className="shrink-0"
              onClick={handleEditOpen}
              variant="outline"
            >
              <PencilIcon data-icon="inline-start" />
              {translate("编辑", "Edit")}
            </Button>
          </header>

          {loadFailed ? (
            <div className="mt-8 rounded-[14px] border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              {translate("加载供应商信息失败", "Failed to load provider")}
              <Button
                className="mt-3"
                onClick={handleRetry}
                size="sm"
                variant="outline"
              >
                {translate("重试", "Retry")}
              </Button>
            </div>
          ) : (
            <>
              <div className="mt-8 overflow-hidden rounded-[14px] border border-border bg-card">
                <div className="border-b border-border/70 bg-muted/40 px-4 py-3 sm:px-5">
                  <h2 className="text-[14px] leading-5 font-medium">
                    {translate("基本配置", "Basic configuration")}
                  </h2>
                </div>
                <dl>
                  <ConfigRow label={translate("协议", "Protocol")}>
                    <span className="truncate">
                      {PROVIDER_PROTOCOL_LABELS[detail.protocol]}
                    </span>
                  </ConfigRow>
                  <ConfigRow label="Base URL">
                    <span className="truncate font-mono text-[13px]">
                      {detail.baseUrl}
                    </span>
                    <CopyButton value={detail.baseUrl} />
                  </ConfigRow>
                  <ConfigRow label="API Key">
                    <span className="truncate font-mono text-[13px]">
                      {apiKeyVisible
                        ? detail.apiKey
                        : maskApiKey(detail.apiKey)}
                    </span>
                    <button
                      aria-label={
                        apiKeyVisible
                          ? translate("隐藏 API Key", "Hide API key")
                          : translate("显示 API Key", "Reveal API key")
                      }
                      className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      onClick={handleApiKeyVisibilityToggle}
                      type="button"
                    >
                      {apiKeyVisible ? (
                        <EyeOffIcon className="size-3.5" />
                      ) : (
                        <EyeIcon className="size-3.5" />
                      )}
                    </button>
                    <CopyButton value={detail.apiKey} />
                  </ConfigRow>
                  <ConfigRow label={translate("状态", "Status")}>
                    <StatusDot enabled={detail.enabled} />
                  </ConfigRow>
                  <ConfigRow label={translate("创建时间", "Created")}>
                    <span className="tabular-nums">
                      {formatStamp(detail.createdAt)}
                    </span>
                  </ConfigRow>
                  <ConfigRow label={translate("更新时间", "Updated")}>
                    <span className="tabular-nums">
                      {formatStamp(detail.updatedAt)}
                    </span>
                  </ConfigRow>
                </dl>
              </div>

              <div className="mt-8 overflow-hidden rounded-[14px] border border-border bg-card">
                <div className="flex flex-col gap-3 border-b border-border/70 bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div>
                    <h2 className="text-[14px] leading-5 font-medium">
                      {translate("模型列表", "Model list")}
                    </h2>
                    <p className="mt-0.5 text-[12px] leading-4 text-muted-foreground">
                      {translate(
                        "在该供应商下管理可用的模型",
                        "Manage the models available under this provider"
                      )}
                    </p>
                  </div>
                  <Button
                    className="shrink-0"
                    onClick={handleCreateModelOpen}
                    size="sm"
                  >
                    <PlusIcon data-icon="inline-start" />
                    {translate("添加模型", "Add model")}
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table
                    aria-label={translate("模型列表", "Model list")}
                    className="w-full min-w-[820px] text-left text-sm"
                  >
                    <thead className="bg-muted/50 text-[13px] text-muted-foreground">
                      <tr>
                        <th className="h-10 px-4 font-medium" scope="col">
                          {translate("模型名称", "Model name")}
                        </th>
                        <th className="h-10 px-4 font-medium" scope="col">
                          Model ID
                        </th>
                        <th className="h-10 px-4 font-medium" scope="col">
                          {translate("类型", "Type")}
                        </th>
                        <th className="h-10 px-4 font-medium" scope="col">
                          {translate("状态", "Status")}
                        </th>
                        <th className="h-10 px-4 font-medium" scope="col">
                          {translate("是否默认", "Default")}
                        </th>
                        <th className="h-10 px-4 font-medium" scope="col">
                          {translate("添加时间", "Added")}
                        </th>
                        <th
                          className="h-10 px-4 text-right font-medium"
                          scope="col"
                        >
                          {translate("操作", "Actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.models.length > 0 ? (
                        detail.models.map((model) => (
                          <ModelRow
                            key={model.id}
                            model={model}
                            onDeleteRequest={handleDeleteRequest}
                            onEdit={handleModelEditRequest}
                            onSetDefault={handleSetDefault}
                            onTest={handleTest}
                            onToggleEnabled={handleToggleEnabled}
                            testing={testingId === model.id}
                          />
                        ))
                      ) : (
                        <tr className="border-t border-border/70">
                          <td
                            className="px-4 py-10 text-center text-sm text-muted-foreground"
                            colSpan={7}
                          >
                            {translate(
                              "该供应商下还没有模型，点击「添加模型」创建",
                              'No models under this provider yet. Click "Add model" to create one.'
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <ProviderDialog
        currentBaseUrl={detail.baseUrl}
        onClose={handleEditClose}
        onSubmit={handleProviderSubmit}
        open={editOpen}
        provider={providerSummary}
        providers={[providerSummary]}
      />

      <ModelDialog
        model={editingModel}
        models={detail.models}
        onClose={handleModelDialogClose}
        onSubmit={
          editingModel ? handleModelUpdateSubmit : handleCreateModelSubmit
        }
        open={createModelOpen || editingModel !== null}
      />

      <AlertDialog
        onOpenChange={handleDeleteDialogChange}
        open={deleteTarget !== null}
      >
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {translate("删除模型？", "Delete model?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {intl("deleteModelDescription", {
                name: deleteTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {translate("取消", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={handleDeleteActionClick}
              variant="destructive"
            >
              {deleting ? (
                <>
                  <Spinner />
                  {translate("删除中…", "Deleting…")}
                </>
              ) : (
                translate("删除", "Delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
