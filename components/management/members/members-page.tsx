"use client";

import {
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  UserRoundIcon,
  UsersRoundIcon,
  UserXIcon,
} from "lucide-react";
import { type ChangeEvent, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  type DepartmentOption,
  MemberDialog,
  type MemberFormValues,
} from "@/components/management/members/member-dialog";
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
import { Input } from "@/components/ui/input";
import {
  formatStamp,
  getAvatarInitial,
  getAvatarTone,
  isLastEnabledAdmin,
  type ManagementMember,
  type MemberStatus,
  ROLE_LABELS,
  STATUS_LABELS,
} from "@/lib/management/members";
import { cn } from "@/lib/utils";

type StatCardProps = {
  "data-testid": string;
  icon: typeof UsersRoundIcon;
  label: string;
  tone: string;
  value: number;
};

function StatCard({
  "data-testid": testId,
  icon: Icon,
  label,
  tone,
  value,
}: StatCardProps) {
  return (
    <div className="flex items-center justify-between rounded-[14px] border border-border bg-card px-5 py-4">
      <div>
        <p className="text-[13px] leading-5 text-muted-foreground">{label}</p>
        <p
          className="mt-1 text-[26px] leading-8 font-semibold tracking-[-0.02em] text-foreground"
          data-testid={testId}
        >
          {value}
        </p>
      </div>
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-[10px]",
          tone
        )}
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>
    </div>
  );
}

/** 成员展示名：旧账号可能没有姓名，回退到邮箱 */
function displayName(member: ManagementMember): string {
  return member.name?.trim() || member.email;
}

function MemberAvatar({ member }: { member: ManagementMember }) {
  const name = displayName(member);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-medium",
        getAvatarTone(name)
      )}
    >
      {getAvatarInitial(name)}
    </span>
  );
}

function RoleBadge({ role }: { role: ManagementMember["role"] }) {
  const { t } = usePreferences();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs leading-4 font-medium",
        role === "admin"
          ? "bg-link-soft text-link-deep"
          : "bg-muted text-muted-foreground"
      )}
    >
      {t(ROLE_LABELS[role])}
    </span>
  );
}

function StatusBadge({ status }: { status: MemberStatus }) {
  const { t } = usePreferences();
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 text-[13px] leading-5",
        status === "enabled" ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <i
        aria-hidden="true"
        className={cn(
          "size-2 rounded-full",
          status === "enabled" ? "bg-link" : "bg-destructive/70"
        )}
      />
      {t(STATUS_LABELS[status])}
    </span>
  );
}

type MemberRowProps = {
  isSelf: boolean;
  member: ManagementMember;
  onDeleteRequest: (member: ManagementMember) => void;
  onEdit: (member: ManagementMember) => void;
  onToggleStatus: (member: ManagementMember) => void;
};

function MemberRow({
  isSelf,
  member,
  onDeleteRequest,
  onEdit,
  onToggleStatus,
}: MemberRowProps) {
  const { t } = usePreferences();
  const isEnabled = member.status === "enabled";

  const handleEditClick = useCallback(() => onEdit(member), [member, onEdit]);
  const handleToggleClick = useCallback(
    () => onToggleStatus(member),
    [member, onToggleStatus]
  );
  const handleDeleteClick = useCallback(
    () => onDeleteRequest(member),
    [member, onDeleteRequest]
  );

  return (
    <tr className="border-t border-border/70 align-middle">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <MemberAvatar member={member} />
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-[14px] leading-5 font-medium",
                isEnabled ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {displayName(member)}
              {isSelf ? (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  （{t("members.currentAccount")}）
                </span>
              ) : null}
            </p>
            <p className="truncate text-xs leading-4 text-muted-foreground">
              {member.email}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[14px] text-muted-foreground">
        {member.departmentName
          ? t(member.departmentName)
          : t("members.unassigned")}
      </td>
      <td className="px-4 py-3">
        <RoleBadge role={member.role} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={member.status} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[13px] text-muted-foreground">
        {formatStamp(member.addedAt)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Button
            aria-label={t("members.editMemberWithName", {
              name: displayName(member),
            })}
            className="h-7 px-2 text-[13px] text-muted-foreground"
            onClick={handleEditClick}
            size="sm"
            variant="ghost"
          >
            <PencilIcon className="size-3.5" />
            {t("members.edit")}
          </Button>
          <Button
            aria-label={t(
              isEnabled
                ? "members.disableMemberWithName"
                : "members.enableMemberWithName",
              { name: displayName(member) }
            )}
            className="h-7 px-2 text-[13px] text-muted-foreground"
            onClick={handleToggleClick}
            size="sm"
            variant="ghost"
          >
            {isEnabled ? (
              <UserXIcon className="size-3.5" />
            ) : (
              <PlayIcon className="size-3.5" />
            )}
            {t(isEnabled ? "common.disable" : "common.enable")}
          </Button>
          <Button
            aria-label={t("members.deleteMember", {
              name: displayName(member),
            })}
            className="h-7 px-2 text-[13px] text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleDeleteClick}
            size="sm"
            variant="ghost"
          >
            {t("common.delete")}
          </Button>
        </div>
      </td>
    </tr>
  );
}

type MembersData = {
  departments: DepartmentOption[];
  members: ManagementMember[];
};

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
        error: body?.error ?? "management.somethingWentWrongTryAgainLater",
      };
    }
    return { data: body };
  } catch {
    return { error: "management.networkErrorTryAgainLater" };
  }
}

export function MembersPage({
  currentUserId,
  initialData,
}: {
  /** 当前登录账号（User 表）id，用于自我保护校验 */
  currentUserId: string | null;
  /** 服务端直出的成员列表与部门选项，变更后经接口刷新 */
  initialData: MembersData;
}) {
  const { t } = usePreferences();
  const [members, setMembers] = useState<ManagementMember[]>(
    initialData.members
  );
  const [departments, setDepartments] = useState<DepartmentOption[]>(
    initialData.departments
  );
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<ManagementMember | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<ManagementMember | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async (): Promise<MembersData | null> => {
    try {
      const response = await fetch("/api/admin/members", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("failed to load members");
      }
      const data = (await response.json()) as MembersData;
      setMembers(data.members);
      setDepartments(data.departments);
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

  const stats = useMemo(() => {
    const enabled = members.filter(
      (member) => member.status === "enabled"
    ).length;
    return { enabled, total: members.length };
  }, [members]);

  const visibleMembers = useMemo(() => {
    if (!normalizedQuery) {
      return members;
    }
    return members.filter((member) =>
      `${displayName(member)} ${member.email} ${member.departmentName ?? ""}`
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    );
  }, [members, normalizedQuery]);

  const handleQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setQuery(event.currentTarget.value),
    []
  );

  const handleEditRequest = useCallback(
    (member: ManagementMember) => setEditingMember(member),
    []
  );

  const handleCreateOpen = useCallback(() => setCreateOpen(true), []);

  const handleDialogClose = useCallback(() => {
    setCreateOpen(false);
    setEditingMember(null);
  }, []);

  const handleCreateSubmit = useCallback(
    async (values: MemberFormValues) => {
      const { error } = await requestJson("/api/admin/members", {
        body: JSON.stringify(values),
        method: "POST",
      });
      if (error) {
        toast.error(t(error));
        return;
      }
      await refresh();
      setCreateOpen(false);
      toast.success(t("members.memberAdded", { name: values.name }));
    },
    [refresh, t]
  );

  const handleUpdateSubmit = useCallback(
    async (values: MemberFormValues) => {
      if (!editingMember) {
        return;
      }
      const targetId = editingMember.id;
      const statusChanged = values.status !== editingMember.status;
      const { error } = await requestJson("/api/admin/members", {
        body: JSON.stringify({
          departmentId: values.departmentId,
          id: targetId,
          name: values.name,
          role: values.role,
          status: values.status,
          title: values.title,
        }),
        method: "PATCH",
      });
      if (error) {
        toast.error(t(error));
        return;
      }
      await refresh();
      setEditingMember(null);
      toast.success(
        statusChanged
          ? t(
              values.status === "enabled"
                ? "members.memberUpdatedAccountEnabled"
                : "members.memberUpdatedAccountDisabled",
              { name: values.name }
            )
          : t("members.memberUpdated", { name: values.name })
      );
    },
    [editingMember, refresh, t]
  );

  const handleToggleStatus = useCallback(
    async (member: ManagementMember) => {
      if (member.status === "enabled" && isLastEnabledAdmin(members, member)) {
        toast.error(
          t("members.atLeastOneEnabledAdministratorIsRequiredMessage")
        );
        return;
      }
      if (member.status === "enabled" && member.userId === currentUserId) {
        toast.error(t("members.youCannotDisableTheCurrentlySignedIn"));
        return;
      }
      const nextStatus: MemberStatus =
        member.status === "enabled" ? "disabled" : "enabled";
      const { error } = await requestJson("/api/admin/members", {
        body: JSON.stringify({
          departmentId: member.departmentId,
          id: member.id,
          name: member.name ?? displayName(member),
          role: member.role,
          status: nextStatus,
          title: member.title,
        }),
        method: "PATCH",
      });
      if (error) {
        toast.error(t(error));
        return;
      }
      await refresh();
      toast.success(
        nextStatus === "enabled"
          ? t("common.enabledWithName", { name: displayName(member) })
          : t("common.disabled", { name: displayName(member) })
      );
    },
    [currentUserId, members, refresh, t]
  );

  const handleDeleteRequest = useCallback(
    (member: ManagementMember) => {
      if (isLastEnabledAdmin(members, member)) {
        toast.error(
          t("members.atLeastOneEnabledAdministratorIsRequiredAction")
        );
        return;
      }
      if (member.userId === currentUserId) {
        toast.error(t("members.youCannotDeleteTheCurrentlySignedIn"));
        return;
      }
      setDeleteTarget(member);
    },
    [currentUserId, members, t]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget || deleting) {
      return;
    }
    const target = deleteTarget;
    const { id } = target;
    setDeleting(true);
    const { error } = await requestJson("/api/admin/members", {
      body: JSON.stringify({ id }),
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
    toast.success(t("members.memberDeleted", { name: displayName(target) }));
  }, [deleteTarget, deleting, refresh, t]);

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
                {t("members.members")}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {t("members.addAndManageTeamMembersAndControl")}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-56">
                <SearchIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/65"
                />
                <Input
                  aria-label={t("common.searchMembers")}
                  className="pl-9"
                  onChange={handleQueryChange}
                  placeholder={t("common.searchNameEmailOrDepartment")}
                  type="search"
                  value={query}
                />
              </div>
              <Button className="shrink-0" onClick={handleCreateOpen}>
                <PlusIcon data-icon="inline-start" />
                {t("members.addMember")}
              </Button>
            </div>
          </header>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              data-testid="member-count-total"
              icon={UsersRoundIcon}
              label={t("members.totalMembers")}
              tone="bg-muted text-foreground"
              value={stats.total}
            />
            <StatCard
              data-testid="member-count-enabled"
              icon={UserRoundIcon}
              label={t("common.enabled")}
              tone="bg-link-soft text-link-deep"
              value={stats.enabled}
            />
            <StatCard
              data-testid="member-count-disabled"
              icon={UserXIcon}
              label={t("members.disabled")}
              tone="bg-muted text-muted-foreground"
              value={stats.total - stats.enabled}
            />
          </div>

          <div className="mt-5 overflow-hidden rounded-[14px] border border-border bg-card">
            <div className="overflow-x-auto">
              <table
                aria-label={t("members.memberList")}
                className="w-full min-w-[720px] text-left text-sm"
              >
                <thead className="bg-muted/50 text-[13px] text-muted-foreground">
                  <tr>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {t("members.member")}
                    </th>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {t("members.department")}
                    </th>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {t("members.role")}
                    </th>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {t("common.status")}
                    </th>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {t("members.added")}
                    </th>
                    <th
                      className="h-10 px-4 text-right font-medium"
                      scope="col"
                    >
                      {t("common.actions")}
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
                        {t("members.failedToLoadMembers")}
                        <Button
                          className="mt-3"
                          onClick={handleRetry}
                          size="sm"
                          variant="outline"
                        >
                          {t("common.retry")}
                        </Button>
                      </td>
                    </tr>
                  ) : visibleMembers.length > 0 ? (
                    visibleMembers.map((member) => (
                      <MemberRow
                        isSelf={member.userId === currentUserId}
                        key={member.id}
                        member={member}
                        onDeleteRequest={handleDeleteRequest}
                        onEdit={handleEditRequest}
                        onToggleStatus={handleToggleStatus}
                      />
                    ))
                  ) : (
                    <tr className="border-t border-border/70">
                      <td
                        className="px-4 py-10 text-center text-sm text-muted-foreground"
                        colSpan={6}
                      >
                        {members.length > 0
                          ? t("common.noMatchingMembers")
                          : t("members.noMembersYetClickAddMemberTo")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <MemberDialog
        currentUserId={currentUserId}
        departments={departments}
        member={editingMember}
        members={members}
        onClose={handleDialogClose}
        onSubmit={editingMember ? handleUpdateSubmit : handleCreateSubmit}
        open={createOpen || editingMember !== null}
      />

      <AlertDialog
        onOpenChange={handleDeleteDialogChange}
        open={deleteTarget !== null}
      >
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("members.confirmDeleteMember")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("members.thisPermanentlyDeletesIncludingTheirAccountMember", {
                email: deleteTarget?.email ?? "",
                name: deleteTarget ? displayName(deleteTarget) : "",
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
