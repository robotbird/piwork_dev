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
  MemberDialog,
  type MemberFormValues,
} from "@/components/management/member-dialog";
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
  getAvatarInitial,
  getAvatarTone,
  isLastEnabledAdmin,
  type ManagementMember,
  type MemberStatus,
  nowStamp,
  ROLE_LABELS,
  SEED_MEMBERS,
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

function MemberAvatar({ name }: { name: string }) {
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
  member: ManagementMember;
  onDeleteRequest: (member: ManagementMember) => void;
  onEdit: (member: ManagementMember) => void;
  onToggleStatus: (member: ManagementMember) => void;
};

function MemberRow({
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
          <MemberAvatar name={member.name} />
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-[14px] leading-5 font-medium",
                isEnabled ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {member.name}
            </p>
            <p className="truncate text-xs leading-4 text-muted-foreground">
              {member.email}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[14px] text-muted-foreground">
        {t(member.department)}
      </td>
      <td className="px-4 py-3">
        <RoleBadge role={member.role} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={member.status} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[13px] text-muted-foreground">
        {member.addedAt}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Button
            aria-label={`编辑成员 ${member.name}`}
            className="h-7 px-2 text-[13px] text-muted-foreground"
            onClick={handleEditClick}
            size="sm"
            variant="ghost"
          >
            <PencilIcon className="size-3.5" />
            {t("编辑")}
          </Button>
          <Button
            aria-label={`${isEnabled ? "停用" : "启用"}成员 ${member.name}`}
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
            {t(isEnabled ? "停用" : "启用")}
          </Button>
          <Button
            aria-label={`删除成员 ${member.name}`}
            className="h-7 px-2 text-[13px] text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleDeleteClick}
            size="sm"
            variant="ghost"
          >
            {t("删除")}
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function MemberManager() {
  const { t } = usePreferences();
  const [members, setMembers] = useState<ManagementMember[]>(SEED_MEMBERS);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<ManagementMember | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<ManagementMember | null>(
    null
  );

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
      `${member.name} ${member.email} ${member.department}`
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
    (values: MemberFormValues) => {
      const id = crypto.randomUUID();
      setMembers((current) => [
        { addedAt: nowStamp(), id, ...values },
        ...current,
      ]);
      setCreateOpen(false);
      toast.success(t("已添加成员「{name}」", { name: values.name }));
    },
    [t]
  );

  const handleUpdateSubmit = useCallback(
    (values: MemberFormValues) => {
      if (!editingMember) {
        return;
      }
      const targetId = editingMember.id;
      const statusChanged = values.status !== editingMember.status;
      setMembers((current) =>
        current.map((member) =>
          member.id === targetId ? { ...member, ...values } : member
        )
      );
      setEditingMember(null);
      toast.success(
        statusChanged
          ? t(
              `已更新成员「{name}」，账号${values.status === "enabled" ? "已启用" : "已停用"}`,
              { name: values.name }
            )
          : t("已更新成员「{name}」", { name: values.name })
      );
    },
    [editingMember, t]
  );

  const handleToggleStatus = useCallback(
    (member: ManagementMember) => {
      if (member.status === "enabled" && isLastEnabledAdmin(members, member)) {
        toast.error(t("需保留至少一名已启用的管理员，无法停用该成员"));
        return;
      }
      const nextStatus: MemberStatus =
        member.status === "enabled" ? "disabled" : "enabled";
      setMembers((current) =>
        current.map((item) =>
          item.id === member.id ? { ...item, status: nextStatus } : item
        )
      );
      toast.success(
        nextStatus === "enabled"
          ? t("已启用「{name}」", { name: member.name })
          : t("已停用「{name}」", { name: member.name })
      );
    },
    [members, t]
  );

  const handleDeleteRequest = useCallback(
    (member: ManagementMember) => {
      if (isLastEnabledAdmin(members, member)) {
        toast.error(t("需保留至少一名已启用的管理员，无法删除该成员"));
        return;
      }
      setDeleteTarget(member);
    },
    [members, t]
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) {
      return;
    }
    const { id, name } = deleteTarget;
    setMembers((current) => current.filter((member) => member.id !== id));
    setDeleteTarget(null);
    toast.success(t("已删除成员「{name}」", { name }));
  }, [deleteTarget, t]);

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
                {t("成员管理")}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {t("添加和管理团队成员，控制他们的访问权限")}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-56">
                <SearchIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/65"
                />
                <Input
                  aria-label={t("搜索成员")}
                  className="pl-9"
                  onChange={handleQueryChange}
                  placeholder={t("搜索姓名、邮箱或部门")}
                  type="search"
                  value={query}
                />
              </div>
              <Button className="shrink-0" onClick={handleCreateOpen}>
                <PlusIcon data-icon="inline-start" />
                {t("添加成员")}
              </Button>
            </div>
          </header>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              data-testid="member-count-total"
              icon={UsersRoundIcon}
              label={t("成员总数")}
              tone="bg-muted text-foreground"
              value={stats.total}
            />
            <StatCard
              data-testid="member-count-enabled"
              icon={UserRoundIcon}
              label={t("已启用")}
              tone="bg-link-soft text-link-deep"
              value={stats.enabled}
            />
            <StatCard
              data-testid="member-count-disabled"
              icon={UserXIcon}
              label={t("未启用")}
              tone="bg-muted text-muted-foreground"
              value={stats.total - stats.enabled}
            />
          </div>

          <div className="mt-5 overflow-hidden rounded-[14px] border border-border bg-card">
            <div className="overflow-x-auto">
              <table
                aria-label={t("成员列表")}
                className="w-full min-w-[720px] text-left text-sm"
              >
                <thead className="bg-muted/50 text-[13px] text-muted-foreground">
                  <tr>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {t("成员")}
                    </th>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {t("部门")}
                    </th>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {t("角色")}
                    </th>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {t("状态")}
                    </th>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {t("添加时间")}
                    </th>
                    <th
                      className="h-10 px-4 text-right font-medium"
                      scope="col"
                    >
                      {t("操作")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMembers.length > 0 ? (
                    visibleMembers.map((member) => (
                      <MemberRow
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
                          ? t("没有匹配的成员")
                          : t("还没有成员，点击「添加成员」创建第一位成员")}
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
            <AlertDialogTitle>{t("删除成员？")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "将永久移除「{name}」（{email}）及其访问权限，删除后无法恢复。",
                {
                  email: deleteTarget?.email ?? "",
                  name: deleteTarget?.name ?? "",
                }
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("取消")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              variant="destructive"
            >
              {t("删除")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
