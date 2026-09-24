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
  const { t } = usePreferences();
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
          message: t("management.enterARoleName"),
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
          message: t("management.aRoleWithThisNameAlreadyExists"),
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
    [description, intl, name, onSubmit, role?.id, roles, t]
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
            {isEdit ? t("management.editRole") : t("management.createRole")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("management.updateTheNameAndDescriptionOfThis")
              : t("management.afterCreatingACustomRoleAddMembers")}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="role-name">{t("management.name")}</Label>
            <Input
              aria-describedby={
                error?.field === "name" ? "role-name-error" : undefined
              }
              aria-invalid={error?.field === "name" ? true : undefined}
              id="role-name"
              onChange={handleNameChange}
              placeholder={t("management.forExampleSkillDeveloper")}
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
              {t("management.description")}
            </Label>
            <Textarea
              id="role-description"
              onChange={handleDescriptionChange}
              placeholder={t(
                "management.optionalBrieflyDescribeWhatThisRoleIs"
              )}
              rows={3}
              value={description}
            />
          </div>

          <DialogFooter className="mt-1">
            <Button onClick={onClose} type="button" variant="outline">
              {t("common.cancel")}
            </Button>
            <Button type="submit">
              {isEdit ? (
                <PencilIcon data-icon="inline-start" />
              ) : (
                <PlusIcon data-icon="inline-start" />
              )}
              {isEdit ? t("common.saveChanges") : t("management.createRole")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
