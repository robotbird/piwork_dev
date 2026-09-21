"use client";

import {
  ExternalLinkIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ChangeEvent, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  formatStamp,
  type ModelProviderSummary,
  PROVIDER_PROTOCOL_LABELS,
  type ProvidersView,
} from "@/lib/management/models";
import { cn } from "@/lib/utils";

function StatusBadge({ enabled }: { enabled: boolean }) {
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

type ProviderRowProps = {
  onDeleteRequest: (provider: ModelProviderSummary) => void;
  onEdit: (provider: ModelProviderSummary) => void;
  onToggleEnabled: (provider: ModelProviderSummary) => void;
  provider: ModelProviderSummary;
};

function ProviderRow({
  onDeleteRequest,
  onEdit,
  onToggleEnabled,
  provider,
}: ProviderRowProps) {
  const intl = useTranslations("management");
  const { translate } = usePreferences();

  const handleEditClick = useCallback(
    () => onEdit(provider),
    [onEdit, provider]
  );
  const handleDeleteClick = useCallback(
    () => onDeleteRequest(provider),
    [onDeleteRequest, provider]
  );
  const handleToggleClick = useCallback(
    () => onToggleEnabled(provider),
    [onToggleEnabled, provider]
  );

  return (
    <tr className="border-t border-border/70 align-middle">
      <td className="px-4 py-3.5">
        <Link
          className="group/name block min-w-0 max-w-[320px] rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--hairline-strong)]"
          href={`/management/models/${provider.id}`}
        >
          <p className="truncate text-[14px] leading-5 font-medium text-foreground group-hover/name:underline group-hover/name:decoration-muted-foreground/40 group-hover/name:underline-offset-4">
            {provider.name}
          </p>
        </Link>
        {provider.description ? (
          <p className="mt-0.5 truncate text-[13px] leading-5 text-muted-foreground">
            {provider.description}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3.5 text-[13px] leading-5 whitespace-nowrap text-muted-foreground">
        {PROVIDER_PROTOCOL_LABELS[provider.protocol]}
      </td>
      <td className="px-4 py-3.5 text-[14px] leading-5 text-muted-foreground tabular-nums">
        {provider.modelCount}
      </td>
      <td className="px-4 py-3.5">
        <StatusBadge enabled={provider.enabled} />
      </td>
      <td className="px-4 py-3.5 text-[13px] leading-5 whitespace-nowrap text-muted-foreground tabular-nums">
        {formatStamp(provider.createdAt)}
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center justify-end gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={intl("providerMoreActions", {
                name: provider.name,
              })}
              asChild
            >
              <Button
                className="size-7 text-muted-foreground hover:text-foreground"
                size="icon-sm"
                variant="ghost"
              >
                <MoreHorizontalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuItem asChild>
                <Link href={`/management/models/${provider.id}`}>
                  <ExternalLinkIcon />
                  {translate("查看模型", "View models")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleEditClick}>
                <PencilIcon />
                {translate("编辑供应商", "Edit provider")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleClick}>
                {provider.enabled
                  ? translate("停用供应商", "Disable provider")
                  : translate("启用供应商", "Enable provider")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDeleteClick}
                variant="destructive"
              >
                <Trash2Icon />
                {translate("删除供应商", "Delete provider")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}

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

export function ModelsPage({ initialData }: { initialData: ProvidersView }) {
  const intl = useTranslations("management");
  const { translate } = usePreferences();
  const router = useRouter();
  const [providers, setProviders] = useState<ModelProviderSummary[]>(
    initialData.providers
  );
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProvider, setEditingProvider] =
    useState<ModelProviderSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ModelProviderSummary | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<ProvidersView | null> => {
    try {
      const response = await fetch("/api/management/models", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("failed to load providers");
      }
      const data = (await response.json()) as ProvidersView;
      setProviders(data.providers);
      setLoadFailed(false);
      return data;
    } catch {
      setLoadFailed(true);
      return null;
    }
  }, []);

  const handleRetry = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const normalizedQuery = query.trim().toLocaleLowerCase();

  const visibleProviders = useMemo(() => {
    if (!normalizedQuery) {
      return providers;
    }
    return providers.filter((provider) =>
      `${provider.name} ${provider.description ?? ""}`
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    );
  }, [normalizedQuery, providers]);

  const handleQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setQuery(event.currentTarget.value),
    []
  );

  const handleCreateOpen = useCallback(() => setCreateOpen(true), []);

  const handleEditRequest = useCallback((provider: ModelProviderSummary) => {
    setEditingProvider(provider);
  }, []);

  const handleDeleteRequest = useCallback((provider: ModelProviderSummary) => {
    setDeleteTarget(provider);
  }, []);

  const handleDialogClose = useCallback(() => {
    setCreateOpen(false);
    setEditingProvider(null);
  }, []);

  const handleCreateSubmit = useCallback(
    async (values: ProviderFormValues) => {
      const { error } = await requestJson("/api/management/models", {
        body: JSON.stringify(values),
        method: "POST",
      });
      if (error) {
        toast.error(translate(error, error));
        return;
      }
      const data = await refresh();
      setCreateOpen(false);
      // 新建后直达详情页继续添加模型
      const created = data?.providers.find((item) => item.name === values.name);
      if (created) {
        router.push(`/management/models/${created.id}`);
        toast.success(intl("providerCreated", { name: values.name }));
      }
    },
    [intl, refresh, router, translate]
  );

  const handleUpdateSubmit = useCallback(
    async (values: ProviderFormValues) => {
      if (!editingProvider) {
        return;
      }
      const target = editingProvider;
      const { error } = await requestJson(
        `/api/management/models/${target.id}`,
        {
          body: JSON.stringify({
            // 留空字段表示保持原值
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
      await refresh();
      setEditingProvider(null);
      toast.success(intl("providerUpdated", { name: values.name }));
    },
    [editingProvider, intl, refresh, translate]
  );

  const handleToggleEnabled = useCallback(
    async (provider: ModelProviderSummary) => {
      if (togglingId) {
        return;
      }
      setTogglingId(provider.id);
      const { error } = await requestJson(
        `/api/management/models/${provider.id}`,
        {
          body: JSON.stringify({ enabled: !provider.enabled }),
          method: "PATCH",
        }
      );
      setTogglingId(null);
      if (error) {
        toast.error(translate(error, error));
        return;
      }
      await refresh();
      toast.success(
        provider.enabled
          ? intl("providerDisabled", { name: provider.name })
          : intl("providerEnabled", { name: provider.name })
      );
    },
    [intl, refresh, togglingId, translate]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget || deleting) {
      return;
    }
    const target = deleteTarget;
    setDeleting(true);
    const { error } = await requestJson(`/api/management/models/${target.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (error) {
      toast.error(translate(error, error));
      setDeleteTarget(null);
      return;
    }
    await refresh();
    setDeleteTarget(null);
    toast.success(intl("providerDeleted", { name: target.name }));
  }, [deleteTarget, deleting, intl, refresh, translate]);

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

  return (
    <>
      <section className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-12 lg:py-16">
        <div className="mx-auto max-w-[960px]">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.025em]">
                {translate("模型管理", "Model management")}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {translate(
                  "管理企业可使用的模型供应商与模型。",
                  "Manage the model providers and models available to your organization."
                )}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-60">
                <SearchIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/65"
                />
                <Input
                  aria-label={translate("搜索供应商", "Search providers")}
                  className="pl-9"
                  onChange={handleQueryChange}
                  placeholder={translate(
                    "搜索供应商名称或描述",
                    "Search provider name or description"
                  )}
                  type="search"
                  value={query}
                />
              </div>
              <Button className="shrink-0" onClick={handleCreateOpen}>
                <PlusIcon data-icon="inline-start" />
                {translate("添加模型供应商", "Add model provider")}
              </Button>
            </div>
          </header>

          <div className="mt-8 overflow-hidden rounded-[14px] border border-border bg-card">
            <div className="overflow-x-auto">
              <table
                aria-label={translate("供应商列表", "Provider list")}
                className="w-full min-w-[760px] text-left text-sm"
              >
                <thead className="bg-muted/50 text-[13px] text-muted-foreground">
                  <tr>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {translate("供应商名称", "Provider name")}
                    </th>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {translate("协议", "Protocol")}
                    </th>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {translate("模型数", "Models")}
                    </th>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {translate("状态", "Status")}
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
                  {loadFailed ? (
                    <tr className="border-t border-border/70">
                      <td
                        className="px-4 py-10 text-center text-sm text-muted-foreground"
                        colSpan={6}
                      >
                        {translate(
                          "加载模型供应商失败",
                          "Failed to load providers"
                        )}
                        <Button
                          className="mt-3"
                          onClick={handleRetry}
                          size="sm"
                          variant="outline"
                        >
                          {translate("重试", "Retry")}
                        </Button>
                      </td>
                    </tr>
                  ) : visibleProviders.length > 0 ? (
                    visibleProviders.map((provider) => (
                      <ProviderRow
                        key={provider.id}
                        onDeleteRequest={handleDeleteRequest}
                        onEdit={handleEditRequest}
                        onToggleEnabled={handleToggleEnabled}
                        provider={provider}
                      />
                    ))
                  ) : (
                    <tr className="border-t border-border/70">
                      <td
                        className="px-4 py-10 text-center text-sm text-muted-foreground"
                        colSpan={6}
                      >
                        {providers.length > 0
                          ? translate(
                              "没有匹配的供应商",
                              "No matching providers"
                            )
                          : translate(
                              "还没有模型供应商，点击「添加模型供应商」开始接入",
                              'No providers yet. Click "Add model provider" to connect one.'
                            )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <ProviderDialog
        onClose={handleDialogClose}
        onSubmit={editingProvider ? handleUpdateSubmit : handleCreateSubmit}
        open={createOpen || editingProvider !== null}
        provider={editingProvider}
        providers={providers}
      />

      <AlertDialog
        onOpenChange={handleDeleteDialogChange}
        open={deleteTarget !== null}
      >
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {translate("删除供应商？", "Delete provider?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {intl("deleteProviderDescription", {
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
