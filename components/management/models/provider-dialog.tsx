"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  isValidBaseUrl,
  type ModelProviderSummary,
  PROVIDER_API_KEY_MAX_LENGTH,
  PROVIDER_BASE_URL_MAX_LENGTH,
  PROVIDER_DESCRIPTION_MAX_LENGTH,
  PROVIDER_NAME_MAX_LENGTH,
} from "@/lib/management/models";

export type ProviderFormValues = {
  apiKey: string;
  baseUrl: string;
  description: string | null;
  enabled: boolean;
  name: string;
};

type FieldName = "name" | "baseUrl" | "apiKey";

type ProviderDialogProps = {
  /** 待编辑供应商；null 表示新建 */
  provider: ModelProviderSummary | null;
  /** 现有供应商列表，用于名称唯一性校验 */
  providers: readonly ModelProviderSummary[];
  /** 编辑时预填的当前 Base URL；未提供则留空表示保持不变 */
  currentBaseUrl?: string;
  onClose: () => void;
  onSubmit: (values: ProviderFormValues) => void;
  open: boolean;
};

export function ProviderDialog({
  provider,
  providers,
  currentBaseUrl,
  onClose,
  onSubmit,
  open,
}: ProviderDialogProps) {
  const { translate } = usePreferences();
  const intl = useTranslations("management");
  const isEdit = provider !== null;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<{
    field: FieldName;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setName(provider?.name ?? "");
      setDescription(provider?.description ?? "");
      // 列表入口未带当前地址时留空，提交时空值表示保持原地址
      setBaseUrl(provider ? (currentBaseUrl ?? "") : "");
      setApiKey("");
      setEnabled(provider?.enabled ?? true);
      setError(null);
    }
  }, [currentBaseUrl, provider, open]);

  const clearError = useCallback((field: FieldName) => {
    setError((current) => (current?.field === field ? null : current));
  }, []);

  const handleNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setName(event.currentTarget.value);
      clearError("name");
    },
    [clearError]
  );

  const handleBaseUrlChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setBaseUrl(event.currentTarget.value);
      clearError("baseUrl");
    },
    [clearError]
  );

  const handleApiKeyChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setApiKey(event.currentTarget.value);
      clearError("apiKey");
    },
    [clearError]
  );

  const handleDescriptionChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) =>
      setDescription(event.currentTarget.value),
    []
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedName = name.trim();
      const trimmedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
      const trimmedApiKey = apiKey.trim();

      if (!trimmedName) {
        setError({
          field: "name",
          message: translate("请输入供应商名称", "Enter a provider name"),
        });
        return;
      }
      if (trimmedName.length > PROVIDER_NAME_MAX_LENGTH) {
        setError({
          field: "name",
          message: intl("providerNameTooLong", {
            count: PROVIDER_NAME_MAX_LENGTH,
          }),
        });
        return;
      }
      const duplicated = providers.some(
        (item) => item.id !== provider?.id && item.name === trimmedName
      );
      if (duplicated) {
        setError({
          field: "name",
          message: translate(
            "已存在同名供应商",
            "A provider with this name already exists"
          ),
        });
        return;
      }
      if (description.trim().length > PROVIDER_DESCRIPTION_MAX_LENGTH) {
        setError({
          field: "name",
          message: intl("providerDescriptionTooLong", {
            count: PROVIDER_DESCRIPTION_MAX_LENGTH,
          }),
        });
        return;
      }
      // 编辑态 Base URL 留空表示保持原地址
      if (trimmedBaseUrl) {
        if (trimmedBaseUrl.length > PROVIDER_BASE_URL_MAX_LENGTH) {
          setError({
            field: "baseUrl",
            message: translate("Base URL 过长", "The base URL is too long"),
          });
          return;
        }
        if (!isValidBaseUrl(trimmedBaseUrl)) {
          setError({
            field: "baseUrl",
            message: translate(
              "Base URL 需为合法的 http(s) 地址",
              "Base URL must be a valid http(s) URL"
            ),
          });
          return;
        }
      } else if (!isEdit) {
        setError({
          field: "baseUrl",
          message: translate("请输入 Base URL", "Enter a base URL"),
        });
        return;
      }
      if (trimmedApiKey.length > PROVIDER_API_KEY_MAX_LENGTH) {
        setError({
          field: "apiKey",
          message: translate("API Key 过长", "The API key is too long"),
        });
        return;
      }
      if (!isEdit && !trimmedApiKey) {
        setError({
          field: "apiKey",
          message: translate("请输入 API Key", "Enter an API key"),
        });
        return;
      }

      onSubmit({
        apiKey: trimmedApiKey,
        baseUrl: trimmedBaseUrl,
        description: description.trim() || null,
        enabled,
        name: trimmedName,
      });
    },
    [
      apiKey,
      baseUrl,
      description,
      enabled,
      intl,
      isEdit,
      name,
      onSubmit,
      provider?.id,
      providers,
      translate,
    ]
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? translate("编辑供应商", "Edit provider")
              : translate("添加模型供应商", "Add model provider")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? translate(
                  "调整供应商信息与访问凭证；API Key 留空表示保持不变。",
                  "Update the provider info and credentials. Leave the API key empty to keep the current one."
                )
              : translate(
                  "接入 OpenAI 兼容的模型服务，创建后可在其下添加模型。",
                  "Connect an OpenAI-compatible model service, then add models under it."
                )}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="provider-name">
              {translate("供应商名称", "Provider name")}
            </Label>
            <Input
              aria-describedby={
                error?.field === "name" ? "provider-name-error" : undefined
              }
              aria-invalid={error?.field === "name" ? true : undefined}
              id="provider-name"
              onChange={handleNameChange}
              placeholder={translate(
                "例如：阿里云百炼",
                "For example: Alibaba Cloud Bailian"
              )}
              value={name}
            />
            {error?.field === "name" ? (
              <p
                className="text-[13px] leading-5 text-destructive"
                id="provider-name-error"
              >
                {error.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="provider-description">
              {translate("描述", "Description")}
            </Label>
            <Textarea
              id="provider-description"
              onChange={handleDescriptionChange}
              placeholder={translate(
                "选填，一句话说明该服务的用途",
                "Optional. Briefly describe what this service is for"
              )}
              rows={2}
              value={description}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="provider-protocol">
              {translate("协议", "Protocol")}
            </Label>
            <Select defaultValue="openai-compatible" disabled>
              <SelectTrigger className="w-full" id="provider-protocol">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai-compatible">
                  OpenAI Compatible
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="provider-base-url">Base URL</Label>
            <Input
              aria-describedby={
                error?.field === "baseUrl"
                  ? "provider-base-url-error"
                  : undefined
              }
              aria-invalid={error?.field === "baseUrl" ? true : undefined}
              id="provider-base-url"
              onChange={handleBaseUrlChange}
              placeholder={
                isEdit && !currentBaseUrl
                  ? translate("留空保持不变", "Leave empty to keep unchanged")
                  : "https://dashscope.aliyuncs.com/compatible-mode/v1"
              }
              value={baseUrl}
            />
            {error?.field === "baseUrl" ? (
              <p
                className="text-[13px] leading-5 text-destructive"
                id="provider-base-url-error"
              >
                {error.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="provider-api-key">API Key</Label>
            <Input
              aria-describedby={
                error?.field === "apiKey" ? "provider-api-key-error" : undefined
              }
              aria-invalid={error?.field === "apiKey" ? true : undefined}
              autoComplete="off"
              id="provider-api-key"
              onChange={handleApiKeyChange}
              placeholder={
                isEdit
                  ? translate("留空保持不变", "Leave empty to keep unchanged")
                  : "sk-..."
              }
              type="password"
              value={apiKey}
            />
            {error?.field === "apiKey" ? (
              <p
                className="text-[13px] leading-5 text-destructive"
                id="provider-api-key-error"
              >
                {error.message}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between rounded-[10px] border border-border px-3.5 py-3">
            <div className="grid gap-0.5">
              <span className="text-[14px] leading-5 font-medium">
                {translate("启用该供应商", "Enable this provider")}
              </span>
              <span className="text-[12px] leading-4 text-muted-foreground">
                {translate(
                  "停用后其下模型暂不可用，默认标记也会取消",
                  "While disabled its models are unavailable and the default flag is cleared"
                )}
              </span>
            </div>
            <Switch
              aria-label={translate("启用该供应商", "Enable this provider")}
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <DialogFooter className="mt-1">
            <Button onClick={onClose} type="button" variant="outline">
              {translate("取消", "Cancel")}
            </Button>
            <Button type="submit">
              {isEdit ? (
                <PencilIcon data-icon="inline-start" />
              ) : (
                <PlusIcon data-icon="inline-start" />
              )}
              {isEdit
                ? translate("保存更改", "Save changes")
                : translate("创建供应商", "Create provider")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
