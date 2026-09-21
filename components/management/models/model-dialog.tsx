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
  MODEL_ID_MAX_LENGTH,
  MODEL_NAME_MAX_LENGTH,
  type ProviderModelItem,
} from "@/lib/management/models";

export type ModelFormValues = {
  modelId: string;
  name: string;
};

type FieldName = "name" | "modelId";

type ModelDialogProps = {
  /** 待编辑模型；null 表示新建 */
  model: ProviderModelItem | null;
  /** 该供应商下已有模型，用于 Model ID 唯一性校验 */
  models: readonly ProviderModelItem[];
  onClose: () => void;
  onSubmit: (values: ModelFormValues) => void;
  open: boolean;
};

export function ModelDialog({
  model,
  models,
  onClose,
  onSubmit,
  open,
}: ModelDialogProps) {
  const { translate } = usePreferences();
  const intl = useTranslations("management");
  const isEdit = model !== null;
  const [name, setName] = useState("");
  const [modelId, setModelId] = useState("");
  const [error, setError] = useState<{
    field: FieldName;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setName(model?.name ?? "");
      setModelId(model?.modelId ?? "");
      setError(null);
    }
  }, [model, open]);

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

  const handleModelIdChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setModelId(event.currentTarget.value);
      clearError("modelId");
    },
    [clearError]
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedName = name.trim();
      const trimmedModelId = modelId.trim();

      if (!trimmedName) {
        setError({
          field: "name",
          message: translate("请输入模型名称", "Enter a model name"),
        });
        return;
      }
      if (trimmedName.length > MODEL_NAME_MAX_LENGTH) {
        setError({
          field: "name",
          message: intl("modelNameTooLong", { count: MODEL_NAME_MAX_LENGTH }),
        });
        return;
      }
      if (!trimmedModelId) {
        setError({
          field: "modelId",
          message: translate("请输入 Model ID", "Enter a model ID"),
        });
        return;
      }
      if (trimmedModelId.length > MODEL_ID_MAX_LENGTH) {
        setError({
          field: "modelId",
          message: intl("modelIdTooLong", { count: MODEL_ID_MAX_LENGTH }),
        });
        return;
      }
      const duplicated = models.some(
        (item) => item.id !== model?.id && item.modelId === trimmedModelId
      );
      if (duplicated) {
        setError({
          field: "modelId",
          message: translate(
            "该供应商下已存在相同 Model ID",
            "This provider already has a model with this ID"
          ),
        });
        return;
      }

      onSubmit({ modelId: trimmedModelId, name: trimmedName });
    },
    [intl, model?.id, modelId, models, name, onSubmit, translate]
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
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? translate("编辑模型", "Edit model")
              : translate("添加模型", "Add model")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? translate(
                  "调整模型展示名称与 Model ID。",
                  "Update the model name and ID."
                )
              : translate(
                  "填写供应商侧的模型标识，添加后可测试连通性。",
                  "Enter the model ID from the provider, then test connectivity."
                )}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="model-name">
              {translate("模型名称", "Model name")}
            </Label>
            <Input
              aria-describedby={
                error?.field === "name" ? "model-name-error" : undefined
              }
              aria-invalid={error?.field === "name" ? true : undefined}
              id="model-name"
              onChange={handleNameChange}
              placeholder={translate(
                "例如：Qwen3 Max",
                "For example: Qwen3 Max"
              )}
              value={name}
            />
            {error?.field === "name" ? (
              <p
                className="text-[13px] leading-5 text-destructive"
                id="model-name-error"
              >
                {error.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="model-id">Model ID</Label>
            <Input
              aria-describedby={
                error?.field === "modelId" ? "model-id-error" : undefined
              }
              aria-invalid={error?.field === "modelId" ? true : undefined}
              id="model-id"
              onChange={handleModelIdChange}
              placeholder="qwen3-max"
              value={modelId}
            />
            {error?.field === "modelId" ? (
              <p
                className="text-[13px] leading-5 text-destructive"
                id="model-id-error"
              >
                {error.message}
              </p>
            ) : null}
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
                : translate("添加模型", "Add model")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
