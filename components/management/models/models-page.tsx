// biome-ignore-all lint/performance/noJsxPropsBind: provider rows bind their own stable record actions

"use client";

import {
  BrainCircuitIcon,
  CheckIcon,
  KeyRoundIcon,
  MoreHorizontalIcon,
  SearchIcon,
  Settings2Icon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import Image from "next/image";
import { type ChangeEvent, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import type {
  ModelPluginCatalogItem,
  ModelPluginInstallationView,
  ModelPluginsView,
} from "@/lib/management/model-plugins";
import { cn } from "@/lib/utils";

type CredentialValues = Record<string, string>;

async function requestJson(url: string, init?: RequestInit) {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    return response.ok
      ? { data: body }
      : { error: body?.error ?? "操作失败，请稍后重试" };
  } catch {
    return { error: "网络异常，请稍后重试" };
  }
}

function ProviderMark({ providerKey }: { providerKey: string }) {
  if (providerKey === "deepseek") {
    return (
      <Image
        alt="DeepSeek"
        className="size-11 shrink-0 rounded-xl"
        height={44}
        src="/images/model-providers/deepseek.svg"
        width={44}
      />
    );
  }
  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-foreground">
      <BrainCircuitIcon className="size-5" />
    </div>
  );
}

function CapabilityTags({
  models,
}: {
  models: ModelPluginCatalogItem["models"];
}) {
  const hasVision = models.some((model) => model.features.vision);
  const hasTools = models.some((model) => model.features.toolCall);
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
        LLM
      </span>
      {hasVision ? (
        <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
          Vision
        </span>
      ) : null}
      {hasTools ? (
        <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
          Tools
        </span>
      ) : null}
    </div>
  );
}

function formatContextWindow(value: number): string {
  if (value >= 1_000_000) {
    return `${value / 1_000_000}M`;
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)}K`;
  }
  return String(value);
}

function ModelTags({
  model,
}: {
  model: ModelPluginCatalogItem["models"][number];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
        LLM
      </span>
      <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
        CHAT
      </span>
      <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
        {formatContextWindow(model.properties.contextSize)}
      </span>
      {model.features.vision ? (
        <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
          VISION
        </span>
      ) : null}
      {model.features.toolCall ? (
        <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
          TOOLS
        </span>
      ) : null}
      {model.features.reasoning ? (
        <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
          REASONING
        </span>
      ) : null}
    </div>
  );
}

function CredentialFields({
  fields,
  onChange,
  values,
}: {
  fields: ModelPluginCatalogItem["credentialFields"];
  onChange: (variable: string, value: string) => void;
  values: CredentialValues;
}) {
  const { translate } = usePreferences();
  return (
    <div className="grid gap-4">
      {fields.map((field) => {
        const label = field.label["zh-CN"] ?? field.label.en ?? field.variable;
        const placeholder =
          field.placeholder?.["zh-CN"] ?? field.placeholder?.en ?? "";
        return (
          <div className="grid gap-2" key={field.variable}>
            <Label htmlFor={`credential-${field.variable}`}>
              {label}
              {field.required ? (
                <span className="ml-1 text-destructive">*</span>
              ) : null}
            </Label>
            <Input
              autoComplete="off"
              id={`credential-${field.variable}`}
              onChange={(event) =>
                onChange(field.variable, event.currentTarget.value)
              }
              placeholder={placeholder}
              type={field.type === "secret-input" ? "password" : "text"}
              value={values[field.variable] ?? ""}
            />
            {field.help ? (
              <p className="text-xs leading-5 text-muted-foreground">
                {field.help.text["zh-CN"] ?? field.help.text.en}
              </p>
            ) : null}
          </div>
        );
      })}
      <div className="flex items-start gap-2 rounded-lg bg-muted/70 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" />
        {translate(
          "凭据将在服务端验证并加密保存，不会返回到浏览器。",
          "Credentials are validated server-side and stored encrypted."
        )}
      </div>
    </div>
  );
}

function InstallDialog({
  item,
  onInstalled,
  onOpenChange,
}: {
  item: ModelPluginCatalogItem | null;
  onInstalled: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const { translate } = usePreferences();
  const [installing, setInstalling] = useState(false);
  const install = useCallback(async () => {
    if (!item || installing) {
      return;
    }
    setInstalling(true);
    const result = await requestJson("/api/management/model-plugins", {
      body: JSON.stringify({ packageId: item.packageId }),
      method: "POST",
    });
    setInstalling(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(translate(`${item.name} 已安装`, `${item.name} installed`));
    onOpenChange(false);
    await onInstalled();
  }, [installing, item, onInstalled, onOpenChange, translate]);

  return (
    <Dialog onOpenChange={onOpenChange} open={item !== null}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {translate("安装模型供应商", "Install model provider")}
          </DialogTitle>
          <DialogDescription>
            {item
              ? `${item.name} ${item.version} · ${item.models.length} 个模型`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {item ? (
          <div className="grid gap-5 py-2">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/25 p-4">
              <ProviderMark providerKey={item.providerKey} />
              <div className="min-w-0">
                <p className="font-medium text-foreground">{item.name}</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  {item.description}
                </p>
                <div className="mt-3">
                  <CapabilityTags models={item.models} />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/25 px-4 py-3 text-sm leading-6 text-muted-foreground">
              {translate(
                "安装只会检查并从源码构建插件。安装完成后，再为供应商配置 API Key 并验证连接。模型清单、上下文参数和服务地址均由插件提供。",
                "Installation inspects and rebuilds the plugin from source. Configure and validate the API key after installation; the endpoint and model catalog come from the plugin."
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {translate("插件网络权限：", "Plugin network access: ")}
              {item.networkHosts.join(", ")}
            </p>
          </div>
        ) : null}
        <DialogFooter>
          <Button
            disabled={installing}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            {translate("取消", "Cancel")}
          </Button>
          <Button disabled={installing} onClick={install}>
            {installing ? <Spinner /> : null}
            {installing
              ? translate("正在安装…", "Installing…")
              : translate("安装供应商", "Install provider")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfigureDialog({
  installation,
  onOpenChange,
  onSaved,
}: {
  installation: ModelPluginInstallationView | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const { translate } = usePreferences();
  const [credentials, setCredentials] = useState<CredentialValues>({});
  const [enabledModels, setEnabledModels] = useState<string[]>(
    installation?.enabledModels ?? []
  );
  const [defaultModelId, setDefaultModelId] = useState<string | null>(
    installation?.defaultModelId ?? null
  );
  const [saving, setSaving] = useState(false);
  const hasCredentialInput = Object.values(credentials).some((value) =>
    value.trim()
  );

  const toggleModel = useCallback((modelId: string, enabled: boolean) => {
    setEnabledModels((current) =>
      enabled
        ? [...new Set([...current, modelId])]
        : current.filter((id) => id !== modelId)
    );
    if (!enabled) {
      setDefaultModelId((current) => (current === modelId ? null : current));
    }
  }, []);
  const changeCredential = useCallback((variable: string, value: string) => {
    setCredentials((current) => ({ ...current, [variable]: value }));
  }, []);
  const save = useCallback(async () => {
    if (!installation || saving) {
      return;
    }
    setSaving(true);
    const hasCredentials = Object.values(credentials).some((value) =>
      value.trim()
    );
    const result = await requestJson(
      `/api/management/model-plugins/${installation.id}`,
      {
        body: JSON.stringify({
          ...(hasCredentials ? { credentials } : {}),
          defaultModelId,
          enabledModels,
        }),
        method: "PATCH",
      }
    );
    setSaving(false);
    if (result.error) {
      return toast.error(result.error);
    }
    toast.success(translate("供应商配置已更新", "Provider updated"));
    onOpenChange(false);
    await onSaved();
  }, [
    credentials,
    defaultModelId,
    enabledModels,
    installation,
    onOpenChange,
    onSaved,
    saving,
    translate,
  ]);

  return (
    <Dialog onOpenChange={onOpenChange} open={installation !== null}>
      <DialogContent className="max-h-[86dvh] max-w-[640px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{installation?.name ?? ""}</DialogTitle>
          <DialogDescription>
            {installation?.credentialsConfigured
              ? translate(
                  "轮换 API Key，或调整启用模型和企业默认模型。",
                  "Rotate the API key or manage enabled and default models."
                )
              : translate(
                  "先添加并验证 API Key，验证通过后才能启用模型。",
                  "Add and validate the API key before enabling models."
                )}
          </DialogDescription>
        </DialogHeader>
        {installation ? (
          <div className="grid gap-6 py-2">
            <section>
              <h3 className="mb-1 text-sm font-medium">
                {installation.credentialsConfigured
                  ? translate("轮换 API Key", "Rotate API key")
                  : translate("添加 API Key", "Add API key")}
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">
                {installation.credentialsConfigured
                  ? translate(
                      "留空表示保留当前 API Key；提交新值时会先验证连接。",
                      "Leave blank to keep the current key. New values are validated first."
                    )
                  : translate(
                      "API 地址由插件固定提供，此处只需要填写供应商 API Key。",
                      "The API endpoint is provided by the plugin; only the provider API key is required."
                    )}
              </p>
              <CredentialFields
                fields={installation.credentialFields}
                onChange={changeCredential}
                values={credentials}
              />
            </section>
            <section>
              <h3 className="mb-3 text-sm font-medium">
                {translate("模型目录", "Model catalog")}
              </h3>
              <div className="overflow-hidden rounded-xl border border-border">
                {installation.models.map((model) => {
                  const enabled = enabledModels.includes(model.modelId);
                  return (
                    <div
                      className="flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-b-0"
                      key={model.modelId}
                    >
                      <Switch
                        aria-label={model.modelId}
                        checked={enabled}
                        disabled={!installation.credentialsConfigured}
                        onCheckedChange={(checked) =>
                          toggleModel(model.modelId, checked)
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {model.label["zh-CN"] ?? model.label.en}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {model.modelId} ·{" "}
                          {model.properties.contextSize.toLocaleString()} ctx
                        </p>
                      </div>
                      <Button
                        disabled={
                          !installation.credentialsConfigured || !enabled
                        }
                        onClick={() => setDefaultModelId(model.modelId)}
                        size="sm"
                        variant={
                          defaultModelId === model.modelId
                            ? "secondary"
                            : "ghost"
                        }
                      >
                        {defaultModelId === model.modelId ? (
                          <CheckIcon className="size-3.5" />
                        ) : null}
                        {translate("默认", "Default")}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        ) : null}
        <DialogFooter>
          <Button
            disabled={saving}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            {translate("取消", "Cancel")}
          </Button>
          <Button
            disabled={
              saving ||
              (!installation?.credentialsConfigured && !hasCredentialInput)
            }
            onClick={save}
          >
            {saving ? <Spinner /> : null}
            {installation?.credentialsConfigured
              ? translate("保存配置", "Save")
              : translate("验证并保存 API Key", "Validate and save API key")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ModelsPage({ initialData }: { initialData: ModelPluginsView }) {
  const { translate } = usePreferences();
  const [data, setData] = useState(initialData);
  const [query, setQuery] = useState("");
  const [installTarget, setInstallTarget] =
    useState<ModelPluginCatalogItem | null>(null);
  const [configureTarget, setConfigureTarget] =
    useState<ModelPluginInstallationView | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<ModelPluginInstallationView | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/management/model-plugins", {
      cache: "no-store",
    });
    if (!response.ok) {
      toast.error(translate("加载供应商失败", "Failed to load providers"));
      return;
    }
    setData((await response.json()) as ModelPluginsView);
  }, [translate]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return data.available.filter(
      (item) =>
        !normalized ||
        `${item.name} ${item.description}`
          .toLocaleLowerCase()
          .includes(normalized)
    );
  }, [data.available, query]);
  const toggle = useCallback(
    async (item: ModelPluginInstallationView) => {
      setBusyId(item.id);
      const result = await requestJson(
        `/api/management/model-plugins/${item.id}`,
        { body: JSON.stringify({ enabled: !item.enabled }), method: "PATCH" }
      );
      setBusyId(null);
      if (result.error) {
        return toast.error(result.error);
      }
      await refresh();
    },
    [refresh]
  );
  const toggleInstalledModel = useCallback(
    async (
      item: ModelPluginInstallationView,
      modelId: string,
      enabled: boolean
    ) => {
      const nextEnabledModels = enabled
        ? [...new Set([...item.enabledModels, modelId])]
        : item.enabledModels.filter((id) => id !== modelId);
      const nextDefaultModelId =
        item.defaultModelId === modelId && !enabled
          ? null
          : (item.defaultModelId ?? (enabled ? modelId : null));
      const operationId = `${item.id}:${modelId}`;
      setBusyId(operationId);
      const result = await requestJson(
        `/api/management/model-plugins/${item.id}`,
        {
          body: JSON.stringify({
            defaultModelId: nextDefaultModelId,
            enabledModels: nextEnabledModels,
          }),
          method: "PATCH",
        }
      );
      setBusyId(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      await refresh();
    },
    [refresh]
  );
  const uninstall = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    const item = deleteTarget;
    setBusyId(item.id);
    const result = await requestJson(
      `/api/management/model-plugins/${item.id}`,
      { method: "DELETE" }
    );
    setBusyId(null);
    if (result.error) {
      return toast.error(result.error);
    }
    toast.success(translate(`${item.name} 已卸载`, `${item.name} uninstalled`));
    setDeleteTarget(null);
    await refresh();
  }, [deleteTarget, refresh, translate]);

  return (
    <>
      <section className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-12 lg:px-12">
        <div className="mx-auto max-w-[1120px]">
          <header>
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">
              {translate("模型供应商", "Model providers")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {translate(
                "安装并配置基于 Pi Provider contract 的模型供应商插件。",
                "Install and configure model providers built on the Pi Provider contract."
              )}
            </p>
          </header>

          <section className="mt-7 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">
                {translate(
                  `已安装供应商（${data.installed.length}）`,
                  `Installed providers (${data.installed.length})`
                )}
              </h2>
              <Button
                disabled={
                  !data.installed.some((item) => item.credentialsConfigured)
                }
                onClick={() =>
                  setConfigureTarget(
                    data.installed.find((item) => item.defaultModelId) ??
                      data.installed.find(
                        (item) => item.credentialsConfigured
                      ) ??
                      null
                  )
                }
                size="sm"
                variant="outline"
              >
                <Settings2Icon />
                {translate("默认模型设置", "Default model")}
              </Button>
            </div>
            {data.installed.length ? (
              <div className="divide-y divide-border">
                {data.installed.map((item) => (
                  <article key={item.id}>
                    <div className="grid gap-4 px-5 py-4 xl:grid-cols-[minmax(260px,1.4fr)_minmax(180px,.8fr)_auto] xl:items-center">
                      <div className="flex min-w-0 items-start gap-3">
                        <ProviderMark providerKey={item.providerKey} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{item.name}</p>
                            <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                              v{item.version}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      <div>
                        <CapabilityTags models={item.models} />
                        <p className="mt-2 text-xs text-muted-foreground">
                          {item.enabledModels.length} / {item.models.length}{" "}
                          {translate("个模型已启用", "models enabled")}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                        <div className="mr-1 text-left xl:text-right">
                          <p
                            className={cn(
                              "text-xs font-medium",
                              item.credentialsConfigured &&
                                item.enabled &&
                                item.healthStatus === "healthy"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground"
                            )}
                          >
                            {item.credentialsConfigured
                              ? item.enabled
                                ? translate("运行正常", "Healthy")
                                : translate("已停用", "Disabled")
                              : translate(
                                  "需要配置 API Key",
                                  "API key required"
                                )}
                          </p>
                          {item.credentialsConfigured ? null : (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {translate(
                                "配置后才可启用模型",
                                "Models unlock after setup"
                              )}
                            </p>
                          )}
                        </div>
                        <Button
                          onClick={() => setConfigureTarget(item)}
                          size="sm"
                          variant={
                            item.credentialsConfigured ? "outline" : "default"
                          }
                        >
                          <KeyRoundIcon />
                          {item.credentialsConfigured
                            ? translate("配置", "Configure")
                            : translate("添加 API Key", "Add API key")}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-label={translate("更多操作", "More actions")}
                              disabled={busyId === item.id}
                              size="icon-sm"
                              variant="ghost"
                            >
                              {busyId === item.id ? (
                                <Spinner />
                              ) : (
                                <MoreHorizontalIcon />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              disabled={!item.credentialsConfigured}
                              onClick={() => toggle(item)}
                            >
                              {item.enabled
                                ? translate("停用", "Disable")
                                : translate("启用", "Enable")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(item)}
                              variant="destructive"
                            >
                              <Trash2Icon />
                              {translate("卸载", "Uninstall")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="border-t border-border/70 bg-muted/15 px-5 py-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        {translate(
                          `${item.models.length} 个插件模型`,
                          `${item.models.length} plugin models`
                        )}
                      </p>
                      <div className="overflow-hidden rounded-xl border border-border bg-background">
                        {item.models.map((model) => {
                          const modelEnabled = item.enabledModels.includes(
                            model.modelId
                          );
                          const modelBusy =
                            busyId === `${item.id}:${model.modelId}`;
                          return (
                            <div
                              className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center"
                              key={model.modelId}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-medium">
                                    {model.label["zh-CN"] ??
                                      model.label.en ??
                                      model.modelId}
                                  </p>
                                  {item.defaultModelId === model.modelId ? (
                                    <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                                      {translate("默认", "Default")}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-1.5">
                                  <ModelTags model={model} />
                                </div>
                              </div>
                              <Switch
                                aria-label={translate(
                                  `启用 ${model.modelId}`,
                                  `Enable ${model.modelId}`
                                )}
                                checked={modelEnabled}
                                disabled={
                                  !item.credentialsConfigured || modelBusy
                                }
                                onCheckedChange={(checked) =>
                                  toggleInstalledModel(
                                    item,
                                    model.modelId,
                                    checked
                                  )
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <BrainCircuitIcon className="mx-auto size-7 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">
                  {translate("尚未安装模型供应商", "No providers installed")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {translate(
                    "从下方目录安装供应商并验证凭据。",
                    "Install a provider from the catalog below."
                  )}
                </p>
              </div>
            )}
          </section>

          <section className="mt-5 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold">
                {translate("发现更多供应商", "Discover providers")}
              </h2>
              <div className="relative w-full sm:w-72">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label={translate("搜索供应商", "Search providers")}
                  className="pl-9"
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setQuery(event.currentTarget.value)
                  }
                  placeholder={translate(
                    "搜索供应商名称或描述",
                    "Search provider name or description"
                  )}
                  type="search"
                  value={query}
                />
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => (
                <article
                  className="flex min-h-48 flex-col rounded-xl border border-border bg-background p-4 transition-colors hover:border-[var(--hairline-strong)]"
                  key={item.packageId}
                >
                  <div className="flex items-start gap-3">
                    <ProviderMark providerKey={item.providerKey} />
                    <div className="min-w-0">
                      <h3 className="font-medium">{item.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        v{item.version} · {item.models.length} models
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-5 text-muted-foreground">
                    {item.description}
                  </p>
                  <div className="mt-auto pt-4">
                    <Button
                      className="w-full"
                      disabled={item.installed}
                      onClick={() => setInstallTarget(item)}
                      variant="outline"
                    >
                      {item.installed ? (
                        <>
                          <CheckIcon />
                          {translate("已安装", "Installed")}
                        </>
                      ) : (
                        translate("安装", "Install")
                      )}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
      <InstallDialog
        item={installTarget}
        onInstalled={refresh}
        onOpenChange={(open) => {
          if (!open) {
            setInstallTarget(null);
          }
        }}
      />
      <ConfigureDialog
        installation={configureTarget}
        key={configureTarget?.id ?? "none"}
        onOpenChange={(open) => {
          if (!open) {
            setConfigureTarget(null);
          }
        }}
        onSaved={refresh}
      />
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        open={deleteTarget !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {translate("卸载模型供应商？", "Uninstall model provider?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {translate(
                `卸载 ${deleteTarget?.name ?? ""} 后，其模型会立即从聊天模型列表中移除。`,
                `Models from ${deleteTarget?.name ?? ""} will be removed from chat immediately.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{translate("取消", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={uninstall} variant="destructive">
              {busyId === deleteTarget?.id ? <Spinner /> : null}
              {translate("卸载", "Uninstall")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
