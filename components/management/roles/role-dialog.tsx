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
import { Textarea } from "@/components/ui/textarea";
import {
  type ManagementRole,
  ROLE_DESCRIPTION_MAX_LENGTH,
  ROLE_NAME_MAX_LENGTH,
} from "@/lib/management/roles";

export type RoleFormValues = {
  description: string | null;
  name: string;
};

type FieldName = "name";

type RoleDialogProps = {
  /** 待编辑角色；null 表示新建 */
  role: ManagementRole | null;
  /** 现有角色列表，用于名称唯一性校验 */
  roles: readonly ManagementRole[];
  onClose: () => void;
  onSubmit: (values: RoleFormValues) => void;
  open: boolean;
};

export function RoleDialog({
  role,
  roles,
  onClose,
  onSubmit,
  open,
}: RoleDialogProps) {
  const { translate } = usePreferences();
  const intl = useTranslations("management");
  const isEdit = role !== null;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<{
    field: FieldName;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setName(role?.name ?? "");
      setDescription(role?.description ?? "");
      setError(null);
    }
  }, [role, open]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedName = name.trim();
      const trimmedDescription = description.trim();

      if (!trimmedName) {
        setError({
          field: "name",
          message: translate("请输入角色名称", "Enter a role name"),
        });
        return;
      }
      if (trimmedName.length > ROLE_NAME_MAX_LENGTH) {
        setError({
          field: "name",
          message: intl("roleNameTooLong", { count: ROLE_NAME_MAX_LENGTH }),
        });
        return;
      }
      const duplicated = roles.some(
        (item) => item.id !== role?.id && item.name === trimmedName
      );
      if (duplicated) {
        setError({
          field: "name",
          message: translate(
            "已存在同名角色",
            "A role with this name already exists"
          ),
        });
        return;
      }
      if (trimmedDescription.length > ROLE_DESCRIPTION_MAX_LENGTH) {
        setError({
          field: "name",
          message: intl("roleDescriptionTooLong", {
            count: ROLE_DESCRIPTION_MAX_LENGTH,
          }),
        });
        return;
      }

      onSubmit({
        description: trimmedDescription || null,
        name: trimmedName,
      });
    },
    [description, intl, name, onSubmit, role?.id, roles, translate]
  );

  const handleNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setName(event.currentTarget.value);
      if (error?.field === "name") {
        setError(null);
      }
    },
    [error]
  );

  const handleDescriptionChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) =>
      setDescription(event.currentTarget.value),
    []
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
              ? translate("编辑角色", "Edit role")
              : translate("新建角色", "Create role")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? translate(
                  "调整自定义角色的名称与描述。",
                  "Update the name and description of this custom role."
                )
              : translate(
                  "创建自定义角色后，可在角色详情中为其添加成员。",
                  "After creating a custom role, add members to it from the role details."
                )}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="role-name">{translate("名称", "Name")}</Label>
            <Input
              aria-describedby={
                error?.field === "name" ? "role-name-error" : undefined
              }
              aria-invalid={error?.field === "name" ? true : undefined}
              id="role-name"
              onChange={handleNameChange}
              placeholder={translate(
                "例如：Skill 开发者",
                "For example: Skill developer"
              )}
              value={name}
            />
            {error?.field === "name" ? (
              <p
                className="text-[13px] leading-5 text-destructive"
                id="role-name-error"
              >
                {error.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role-description">
              {translate("描述", "Description")}
            </Label>
            <Textarea
              id="role-description"
              onChange={handleDescriptionChange}
              placeholder={translate(
                "选填，一句话说明该角色的用途",
                "Optional. Briefly describe what this role is for"
              )}
              rows={3}
              value={description}
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
                : translate("创建角色", "Create role")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
