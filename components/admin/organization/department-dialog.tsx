"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
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
import {
  buildDepartmentTree,
  type Department,
  type DepartmentNode,
  getDescendantIds,
  getMemberDisplayName,
  type MemberSummary,
} from "@/lib/admin/organization";

export type DepartmentFormValues = {
  leaderId: string | null;
  name: string;
  parentId: string | null;
};

/** Select 组件不接受空字符串值，未设置负责人 / 未分配部门用哨兵值表示 */
const NONE_OPTION = "__none__";

type DepartmentDialogProps = {
  /** 新建时默认选中的上级部门（通常为当前选中部门） */
  defaultParentId?: string | null;
  departments: Department[];
  /** 待编辑部门；null 表示新建 */
  department: Department | null;
  members: readonly MemberSummary[];
  onClose: () => void;
  /** 编辑态请求删除，由父级弹出确认框 */
  onDeleteRequest: (department: Department) => void;
  onSubmit: (values: DepartmentFormValues) => void;
  open: boolean;
};

function flattenTree(nodes: DepartmentNode[]): DepartmentNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)]);
}

export function DepartmentDialog({
  defaultParentId = null,
  departments,
  department,
  members,
  onClose,
  onDeleteRequest,
  onSubmit,
  open,
}: DepartmentDialogProps) {
  const { t } = usePreferences();
  const intl = useTranslations("organization");
  const isEdit = department !== null;
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [leaderId, setLeaderId] = useState<string>(NONE_OPTION);
  const [error, setError] = useState<{
    field: "name" | "parent";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setName(department?.name ?? "");
      // 编辑时原样沿用原上级：顶级部门的 parentId 为 null，不能用 ?? 兜底，
      // 否则会被默认上级（可能是自身）覆盖，导致顶级部门无法保存
      setParentId(
        department
          ? department.parentId
          : (defaultParentId ?? departments[0]?.id ?? null)
      );
      setLeaderId(department?.leaderId ?? NONE_OPTION);
      setError(null);
    }
  }, [defaultParentId, department, departments, open]);

  const selectableDepartments = useMemo(() => {
    if (!isEdit || !department) {
      return flattenTree(buildDepartmentTree(departments));
    }
    const excludedIds = getDescendantIds(departments, department.id);
    const excluded = new Set<string>([department.id, ...excludedIds]);
    return flattenTree(buildDepartmentTree(departments)).filter(
      (node) => !excluded.has(node.department.id)
    );
  }, [departments, department, isEdit]);

  const childCount = useMemo(() => {
    if (!department) {
      return 0;
    }
    return getDescendantIds(departments, department.id).size;
  }, [departments, department]);

  const directMemberCount = useMemo(
    () =>
      department
        ? members.filter((item) => item.departmentId === department.id).length
        : 0,
    [department, members]
  );
  const isRoot = department !== null && department.parentId === null;
  const hasDepartments = departments.length > 0;

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedName = name.trim();

      if (!trimmedName) {
        setError({
          field: "name",
          message: t("organization.enterADepartmentName"),
        });
        return;
      }
      // 兜底校验：上级部门不能是自身或其下级部门，防止形成组织环
      if (
        department &&
        parentId !== null &&
        (parentId === department.id ||
          getDescendantIds(departments, department.id).has(parentId))
      ) {
        setError({
          field: "parent",
          message: t("organization.aDepartmentCannotReportToItselfOr"),
        });
        return;
      }
      const duplicated = departments.some(
        (item) =>
          item.id !== department?.id &&
          item.parentId === parentId &&
          item.name === trimmedName
      );
      if (duplicated) {
        setError({
          field: "name",
          message: t("organization.aDepartmentWithThisNameAlreadyExists"),
        });
        return;
      }

      onSubmit({
        leaderId: leaderId === NONE_OPTION ? null : leaderId,
        name: trimmedName,
        parentId,
      });
    },
    [departments, department, leaderId, name, onSubmit, parentId, t]
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

  const handleParentChange = useCallback(
    (value: string) => {
      setParentId(value);
      if (error?.field === "parent") {
        setError(null);
      }
    },
    [error]
  );

  const handleLeaderChange = useCallback((value: string) => {
    setLeaderId(value);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        onClose();
      }
    },
    [onClose]
  );

  const handleDeleteClick = useCallback(() => {
    if (department) {
      onDeleteRequest(department);
    }
  }, [department, onDeleteRequest]);

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t("organization.editDepartment")
              : t("organization.newDepartment")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("organization.updateDepartmentDetailsChangesSyncToThe")
              : t("organization.createADepartmentUnderTheSelectedParent")}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="department-name">
              {t("organization.departmentName")}
            </Label>
            <Input
              aria-describedby={
                error?.field === "name" ? "department-name-error" : undefined
              }
              aria-invalid={error?.field === "name" ? true : undefined}
              id="department-name"
              onChange={handleNameChange}
              placeholder={t("organization.forExampleMarketing")}
              value={name}
            />
            {error?.field === "name" ? (
              <p
                className="text-[13px] leading-5 text-destructive"
                id="department-name-error"
              >
                {error.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="department-parent">
              {t("organization.parentDepartment")}
            </Label>
            {hasDepartments ? (
              isRoot ? (
                <Input
                  disabled
                  id="department-parent"
                  value={t("organization.topLevelOrganization")}
                />
              ) : (
                <Select
                  onValueChange={handleParentChange}
                  value={parentId ?? undefined}
                >
                  <SelectTrigger
                    aria-describedby={
                      error?.field === "parent"
                        ? "department-parent-error"
                        : undefined
                    }
                    aria-invalid={error?.field === "parent" ? true : undefined}
                    className="w-full"
                    id="department-parent"
                  >
                    <SelectValue
                      placeholder={t("organization.selectParentDepartment")}
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {selectableDepartments.map((node) => (
                      <SelectItem
                        key={node.department.id}
                        value={node.department.id}
                      >
                        {"　".repeat(node.depth) + node.department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            ) : (
              <Input
                disabled
                id="department-parent"
                value={t("organization.topLevelOrganization")}
              />
            )}
            {isRoot ? (
              <p className="text-[12px] leading-5 text-muted-foreground">
                {t("organization.theParentOfTheTopLevelOrganization")}
              </p>
            ) : null}
            {error?.field === "parent" ? (
              <p
                className="text-[13px] leading-5 text-destructive"
                id="department-parent-error"
              >
                {error.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="department-leader">
              {t("organization.manager")}
            </Label>
            <Select onValueChange={handleLeaderChange} value={leaderId}>
              <SelectTrigger className="w-full" id="department-leader">
                <SelectValue placeholder={t("organization.selectManager")} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={NONE_OPTION}>
                  {t("organization.notSet")}
                </SelectItem>
                {members.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {getMemberDisplayName(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[12px] leading-5 text-muted-foreground">
              {t("organization.selectADepartmentManagerFromTheMember")}
            </p>
          </div>

          {isEdit && department ? (
            <div className="mt-1 grid gap-3 rounded-[10px] border border-destructive/25 bg-destructive/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-foreground">
                    {t("organization.deleteDepartment")}
                  </p>
                  <p className="mt-1 max-w-[300px] text-[12px] leading-5 text-muted-foreground">
                    {childCount > 0
                      ? intl("departmentHasChildren", { count: childCount })
                      : directMemberCount > 0
                        ? intl("directMembersBecomeUnassigned", {
                            count: directMemberCount,
                          })
                        : t("organization.thisActionCannotBeUndone")}
                  </p>
                </div>
                <Button
                  disabled={childCount > 0}
                  onClick={handleDeleteClick}
                  size="sm"
                  type="button"
                  variant="destructive"
                >
                  {t("organization.deleteDepartment")}
                </Button>
              </div>
            </div>
          ) : null}

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
              {isEdit
                ? t("common.saveChanges")
                : t("organization.createDepartment")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
