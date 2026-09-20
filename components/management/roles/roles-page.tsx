"use client";

import {
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type ChangeEvent, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  RoleDialog,
  type RoleFormValues,
} from "@/components/management/roles/role-dialog";
import { RoleMembersDialog } from "@/components/management/roles/role-members-dialog";
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
import {
  type ManagementRole,
  ROLE_TYPE_LABELS,
  type RoleMemberOption,
  type RolesView,
} from "@/lib/management/roles";
import { cn } from "@/lib/utils";

function RoleTypeBadge({ type }: { type: ManagementRole["type"] }) {
  const { translate } = usePreferences();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs leading-4 font-medium",
        type === "system"
          ? "bg-muted text-muted-foreground"
          : "bg-link-soft text-link-deep"
      )}
    >
      {translate(
        ROLE_TYPE_LABELS[type],
        type === "system" ? "System" : "Custom"
      )}
    </span>
  );
}

type RoleRowProps = {
  onEdit: (role: ManagementRole) => void;
  onDeleteRequest: (role: ManagementRole) => void;
  onView: (role: ManagementRole) => void;
  role: ManagementRole;
};

function RoleRow({ onEdit, onDeleteRequest, onView, role }: RoleRowProps) {
  const intl = useTranslations("management");
  const { translate } = usePreferences();
  const isSystem = role.type === "system";

  const handleViewClick = useCallback(() => onView(role), [onView, role]);
  const handleEditClick = useCallback(() => onEdit(role), [onEdit, role]);
  const handleDeleteClick = useCallback(
    () => onDeleteRequest(role),
    [onDeleteRequest, role]
  );

  return (
    <tr className="border-t border-border/70 align-middle">
      <td className="px-4 py-3 text-[14px] leading-5 font-medium text-foreground">
        {role.name}
      </td>
      <td className="max-w-[280px] px-4 py-3">
        <p className="truncate text-[14px] leading-5 text-muted-foreground">
          {role.description ?? "—"}
        </p>
      </td>
      <td className="px-4 py-3 text-[14px] leading-5 text-muted-foreground tabular-nums">
        {role.memberIds.length}
      </td>
      <td className="px-4 py-3">
        <RoleTypeBadge type={role.type} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={intl("roleMoreActions", { name: role.name })}
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
            <DropdownMenuContent align="end" className="min-w-36">
              <DropdownMenuItem onClick={handleViewClick}>
                <ShieldCheckIcon />
                {translate("管理成员", "Manage members")}
              </DropdownMenuItem>
              {isSystem ? null : (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleEditClick}>
                    <PencilIcon />
                    {translate("编辑角色", "Edit role")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDeleteClick}
                    variant="destructive"
                  >
                    <Trash2Icon />
                    {translate("删除角色", "Delete role")}
                  </DropdownMenuItem>
                </>
              )}
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

export function RolesPage({
  initialData,
}: {
  /** 服务端直出的角色列表与成员候选，变更后经接口刷新 */
  initialData: RolesView;
}) {
  const intl = useTranslations("management");
  const { translate } = usePreferences();
  const [roles, setRoles] = useState<ManagementRole[]>(initialData.roles);
  const [members, setMembers] = useState<RoleMemberOption[]>(
    initialData.members
  );
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<ManagementRole | null>(null);
  const [viewingRole, setViewingRole] = useState<ManagementRole | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagementRole | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async (): Promise<RolesView | null> => {
    try {
      const response = await fetch("/api/management/roles", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("failed to load roles");
      }
      const data = (await response.json()) as RolesView;
      setRoles(data.roles);
      setMembers(data.members);
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

  const visibleRoles = useMemo(() => {
    if (!normalizedQuery) {
      return roles;
    }
    return roles.filter((role) =>
      `${role.name} ${role.description ?? ""}`
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    );
  }, [normalizedQuery, roles]);

  const handleQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setQuery(event.currentTarget.value),
    []
  );

  const handleCreateOpen = useCallback(() => setCreateOpen(true), []);

  const handleViewRequest = useCallback((role: ManagementRole) => {
    setViewingRole(role);
  }, []);

  const handleEditRequest = useCallback((role: ManagementRole) => {
    setEditingRole(role);
  }, []);

  const handleDeleteRequest = useCallback((role: ManagementRole) => {
    setDeleteTarget(role);
  }, []);

  const handleDialogClose = useCallback(() => {
    setCreateOpen(false);
    setEditingRole(null);
  }, []);

  const handleMembersSaved = useCallback((updated: ManagementRole) => {
    setRoles((current) =>
      current.map((role) => (role.id === updated.id ? updated : role))
    );
    setViewingRole(updated);
  }, []);

  const handleCreateSubmit = useCallback(
    async (values: RoleFormValues) => {
      const { error } = await requestJson("/api/management/roles", {
        body: JSON.stringify(values),
        method: "POST",
      });
      if (error) {
        toast.error(translate(error, error));
        return;
      }
      await refresh();
      setCreateOpen(false);
      toast.success(intl("roleCreated", { name: values.name }));
    },
    [intl, refresh, translate]
  );

  const handleUpdateSubmit = useCallback(
    async (values: RoleFormValues) => {
      if (!editingRole) {
        return;
      }
      const targetId = editingRole.id;
      const { error } = await requestJson("/api/management/roles", {
        body: JSON.stringify({ id: targetId, ...values }),
        method: "PATCH",
      });
      if (error) {
        toast.error(translate(error, error));
        return;
      }
      await refresh();
      setEditingRole(null);
      toast.success(intl("roleUpdated", { name: values.name }));
    },
    [editingRole, intl, refresh, translate]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget || deleting) {
      return;
    }
    const target = deleteTarget;
    setDeleting(true);
    const { error } = await requestJson("/api/management/roles", {
      body: JSON.stringify({ id: target.id }),
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
    toast.success(intl("roleDeleted", { name: target.name }));
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

  const handleViewingClose = useCallback(() => setViewingRole(null), []);

  return (
    <>
      <section className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-12 lg:py-16">
        <div className="mx-auto max-w-[960px]">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.025em]">
                {translate("角色与权限", "Roles & permissions")}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {translate(
                  "创建和管理角色，并为角色选择成员；系统角色由系统维护",
                  "Create and manage roles and assign members to them. System roles are maintained by the system."
                )}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-56">
                <SearchIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/65"
                />
                <Input
                  aria-label={translate("搜索角色", "Search roles")}
                  className="pl-9"
                  onChange={handleQueryChange}
                  placeholder={translate(
                    "搜索名称或描述",
                    "Search name or description"
                  )}
                  type="search"
                  value={query}
                />
              </div>
              <Button className="shrink-0" onClick={handleCreateOpen}>
                <PlusIcon data-icon="inline-start" />
                {translate("新建角色", "Create role")}
              </Button>
            </div>
          </header>

          <div className="mt-8 overflow-hidden rounded-[14px] border border-border bg-card">
            <div className="overflow-x-auto">
              <table
                aria-label={translate("角色列表", "Role list")}
                className="w-full min-w-[720px] text-left text-sm"
              >
                <thead className="bg-muted/50 text-[13px] text-muted-foreground">
                  <tr>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {translate("名称", "Name")}
                    </th>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {translate("描述", "Description")}
                    </th>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {translate("成员数", "Members")}
                    </th>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {translate("类型", "Type")}
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
                        colSpan={5}
                      >
                        {translate("加载角色数据失败", "Failed to load roles")}
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
                  ) : visibleRoles.length > 0 ? (
                    visibleRoles.map((role) => (
                      <RoleRow
                        key={role.id}
                        onDeleteRequest={handleDeleteRequest}
                        onEdit={handleEditRequest}
                        onView={handleViewRequest}
                        role={role}
                      />
                    ))
                  ) : (
                    <tr className="border-t border-border/70">
                      <td
                        className="px-4 py-10 text-center text-sm text-muted-foreground"
                        colSpan={5}
                      >
                        {roles.length > 0
                          ? translate("没有匹配的角色", "No matching roles")
                          : translate(
                              "还没有角色，系统角色会在首次访问时自动创建",
                              "No roles yet. System roles are created automatically on first visit."
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

      <RoleDialog
        onClose={handleDialogClose}
        onSubmit={editingRole ? handleUpdateSubmit : handleCreateSubmit}
        open={createOpen || editingRole !== null}
        role={editingRole}
        roles={roles}
      />

      <RoleMembersDialog
        members={members}
        onClose={handleViewingClose}
        onSaved={handleMembersSaved}
        open={viewingRole !== null}
        role={viewingRole}
      />

      <AlertDialog
        onOpenChange={handleDeleteDialogChange}
        open={deleteTarget !== null}
      >
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {translate("删除角色？", "Delete role?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {intl("deleteRoleDescription", {
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
              {deleting
                ? translate("删除中…", "Deleting…")
                : translate("删除", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
