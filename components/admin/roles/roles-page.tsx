// biome-ignore-all lint/performance/noJsxPropsBind: React Compiler memoizes this view; role rows bind their own record actions.
"use client";

import {
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Tabs } from "radix-ui";
import { type ChangeEvent, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  RoleDialog,
  type RoleFormValues,
} from "@/components/admin/roles/role-dialog";
import { RoleMembersDialog } from "@/components/admin/roles/role-members-dialog";
import { RolePoliciesPanel } from "@/components/admin/roles/role-policies-panel";
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
import type { AdminRole, RoleMemberOption, RolesView } from "@/lib/admin/roles";
import {
  getRoleAvatarInitial,
  getRoleMemberDisplayName,
} from "@/lib/admin/roles";
import { cn } from "@/lib/utils";

function RoleTypeBadge({ type }: { type: AdminRole["type"] }) {
  const { t } = usePreferences();
  return (
    <span className="inline-flex items-center rounded-sm bg-muted px-2 py-0.5 text-xs leading-4 font-medium text-muted-foreground">
      {t(type === "system" ? "admin.systemRoleType" : "admin.customRoleType")}
    </span>
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
      return {
        error: body?.error ?? "admin.somethingWentWrongTryAgainLater",
      };
    }
    return { data: body };
  } catch {
    return { error: "admin.networkErrorTryAgainLater" };
  }
}

export function RolesPage({
  initialData,
}: {
  /** 服务端直出的角色列表与成员候选，变更后经接口刷新 */
  initialData: RolesView;
}) {
  const intl = useTranslations("admin");
  const { t } = usePreferences();
  const [roles, setRoles] = useState<AdminRole[]>(initialData.roles);
  const [members, setMembers] = useState<RoleMemberOption[]>(
    initialData.members
  );
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialData.roles[0]?.id ?? null
  );
  const [activeTab, setActiveTab] = useState("members");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [viewingRole, setViewingRole] = useState<AdminRole | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminRole | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async (): Promise<RolesView | null> => {
    try {
      const response = await fetch("/api/admin/roles", {
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

  const selectedRole =
    visibleRoles.find((role) => role.id === selectedId) ??
    visibleRoles[0] ??
    null;
  const selectedMembers = members.filter((member) =>
    selectedRole?.memberIds.includes(member.id)
  );

  const handleViewRequest = useCallback((role: AdminRole) => {
    setViewingRole(role);
  }, []);

  const handleEditRequest = useCallback((role: AdminRole) => {
    setEditingRole(role);
  }, []);

  const handleDeleteRequest = useCallback((role: AdminRole) => {
    setDeleteTarget(role);
  }, []);

  const handleDialogClose = useCallback(() => {
    setCreateOpen(false);
    setEditingRole(null);
  }, []);

  const handleMembersSaved = useCallback((updated: AdminRole) => {
    setRoles((current) =>
      current.map((role) => (role.id === updated.id ? updated : role))
    );
    setViewingRole((current) =>
      current?.id === updated.id ? updated : current
    );
  }, []);

  const handleCreateSubmit = useCallback(
    async (values: RoleFormValues) => {
      const { error } = await requestJson("/api/admin/roles", {
        body: JSON.stringify(values),
        method: "POST",
      });
      if (error) {
        toast.error(t(error));
        return;
      }
      const data = await refresh();
      setSelectedId(
        data?.roles.find((role) => role.name === values.name)?.id ?? null
      );
      setActiveTab("members");
      setCreateOpen(false);
      toast.success(intl("roleCreated", { name: values.name }));
    },
    [intl, refresh, t]
  );

  const handleUpdateSubmit = useCallback(
    async (values: RoleFormValues) => {
      if (!editingRole) {
        return;
      }
      const targetId = editingRole.id;
      const { error } = await requestJson("/api/admin/roles", {
        body: JSON.stringify({ id: targetId, ...values }),
        method: "PATCH",
      });
      if (error) {
        toast.error(t(error));
        return;
      }
      await refresh();
      setEditingRole(null);
      toast.success(intl("roleUpdated", { name: values.name }));
    },
    [editingRole, intl, refresh, t]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget || deleting) {
      return;
    }
    const target = deleteTarget;
    setDeleting(true);
    const { error } = await requestJson("/api/admin/roles", {
      body: JSON.stringify({ id: target.id }),
      method: "DELETE",
    });
    setDeleting(false);
    if (error) {
      toast.error(t(error));
      setDeleteTarget(null);
      return;
    }
    await refresh();
    setDeleteTarget(null);
    toast.success(intl("roleDeleted", { name: target.name }));
  }, [deleteTarget, deleting, intl, refresh, t]);

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
      <section className="min-w-0 px-5 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1440px]">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-heading-lg">{t("admin.rolesPermissions")}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {t("roleWorkspace.description")}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button className="shrink-0" onClick={handleCreateOpen}>
                <PlusIcon data-icon="inline-start" />
                {t("admin.createRole")}
              </Button>
            </div>
          </header>

          {loadFailed ? (
            <div
              className="mt-5 flex items-center gap-3 text-sm text-destructive"
              role="alert"
            >
              {t("admin.failedToLoadRoles")}
              <Button onClick={handleRetry} size="sm" variant="outline">
                {t("common.retry")}
              </Button>
            </div>
          ) : null}
          <div className="mt-6 grid min-h-[640px] gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside
              aria-label={t("admin.roleList")}
              className="min-w-0 rounded-xl border border-border bg-card p-2"
            >
              <div className="relative m-2 mb-5">
                <SearchIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  aria-label={t("admin.searchRoles")}
                  className="bg-muted/40 pl-9"
                  onChange={handleQueryChange}
                  placeholder={t("admin.searchNameOrDescription")}
                  type="search"
                  value={query}
                />
              </div>
              <div className="max-h-64 overflow-y-auto lg:max-h-[calc(100vh-240px)]">
                {visibleRoles.map((role) => (
                  <button
                    aria-pressed={selectedRole?.id === role.id}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-md border-l-2 border-transparent px-5 py-4 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring",
                      selectedRole?.id === role.id &&
                        "border-primary bg-muted text-foreground"
                    )}
                    key={role.id}
                    onClick={() => {
                      setSelectedId(role.id);
                      setActiveTab("members");
                    }}
                    type="button"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {role.name}
                      </span>
                      <span
                        aria-hidden="true"
                        className="mt-1 block truncate text-xs text-muted-foreground"
                      >
                        {role.description ?? t("admin.noDescriptionYet")}
                      </span>
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {intl("memberCount", { count: role.memberIds.length })}
                    </span>
                  </button>
                ))}
                {visibleRoles.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {roles.length
                      ? t("admin.noMatchingRoles")
                      : t("admin.noRolesYetSystemRolesAreCreated")}
                  </p>
                ) : null}
              </div>
            </aside>
            <div className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6">
              {selectedRole ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-heading-md break-words">
                          {selectedRole.name}
                        </h2>
                        <span className="flex items-center gap-1 rounded-sm bg-muted px-2 py-1 text-xs text-muted-foreground">
                          <UsersIcon className="size-3.5" />
                          {intl("memberCount", {
                            count: selectedRole.memberIds.length,
                          })}
                        </span>
                        <RoleTypeBadge type={selectedRole.type} />
                      </div>
                      <p className="mt-2 break-words text-sm text-muted-foreground">
                        {selectedRole.description ??
                          t("admin.noDescriptionYet")}
                      </p>
                    </div>
                    {selectedRole.type === "custom" ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-label={intl("roleMoreActions", {
                              name: selectedRole.name,
                            })}
                            size="icon-sm"
                            variant="ghost"
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleEditRequest(selectedRole)}
                          >
                            <PencilIcon />
                            {t("admin.editRole")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteRequest(selectedRole)}
                            variant="destructive"
                          >
                            <Trash2Icon />
                            {t("admin.deleteRole")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                  <Tabs.Root
                    className="mt-6"
                    onValueChange={setActiveTab}
                    value={activeTab}
                  >
                    <Tabs.List
                      aria-label={t("admin.rolesPermissions")}
                      className="flex gap-5 border-b border-border sm:gap-8"
                    >
                      {(["members", "models", "quota"] as const).map((tab) => (
                        <Tabs.Trigger
                          className="border-b-2 border-transparent px-1 pb-3 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:border-primary data-[state=active]:text-foreground"
                          key={tab}
                          value={tab}
                        >
                          {t(`roleWorkspace.${tab}`)}
                        </Tabs.Trigger>
                      ))}
                    </Tabs.List>
                    <Tabs.Content
                      className="mt-5 rounded-xl border border-border p-4"
                      value="members"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-base font-medium">
                            {t("admin.roleMembers")}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {t("roleWorkspace.membersHint")}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleViewRequest(selectedRole)}
                          variant="outline"
                        >
                          <PlusIcon className="size-4" />
                          {t("admin.manageMembers")}
                        </Button>
                      </div>
                      <div className="mt-5 overflow-x-auto rounded-lg border border-border">
                        <table
                          aria-label={t("admin.roleMembers")}
                          className="w-full min-w-[540px] text-left text-sm"
                        >
                          <thead className="bg-muted/40 text-muted-foreground">
                            <tr>
                              {[
                                t("admin.name"),
                                t("profile.email"),
                                t("profile.department"),
                              ].map((label) => (
                                <th
                                  className="px-4 py-3 font-medium"
                                  key={label}
                                  scope="col"
                                >
                                  {label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {selectedMembers.map((member) => {
                              const name = getRoleMemberDisplayName(member);
                              return (
                                <tr
                                  className="border-t border-border/70"
                                  key={member.id}
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <span
                                        aria-hidden="true"
                                        className="grid size-9 shrink-0 place-items-center rounded-full bg-muted font-medium text-foreground"
                                      >
                                        {getRoleAvatarInitial(name)}
                                      </span>
                                      <span>{name}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground">
                                    {member.email}
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground">
                                    {member.departmentName ??
                                      t("profile.unassigned")}
                                  </td>
                                </tr>
                              );
                            })}
                            {selectedMembers.length === 0 ? (
                              <tr>
                                <td
                                  className="px-4 py-12 text-center text-muted-foreground"
                                  colSpan={3}
                                >
                                  {t("roleWorkspace.emptyMembers")}
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    </Tabs.Content>
                    {(["models", "quota"] as const).map((tab) => (
                      <Tabs.Content key={tab} value={tab}>
                        <RolePoliciesPanel
                          key={`${selectedRole.id}-${tab}`}
                          onSaved={handleMembersSaved}
                          role={selectedRole}
                          tab={tab}
                        />
                      </Tabs.Content>
                    ))}
                  </Tabs.Root>
                </>
              ) : (
                <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">
                  {t("admin.noMatchingRoles")}
                </div>
              )}
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
            <AlertDialogTitle>{t("admin.confirmDeleteRole")}</AlertDialogTitle>
            <AlertDialogDescription>
              {intl("deleteRoleDescription", {
                name: deleteTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={handleDeleteActionClick}
              variant="destructive"
            >
              {deleting ? t("common.deleting") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
