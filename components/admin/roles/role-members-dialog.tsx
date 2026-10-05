"use client";

import { CheckIcon, SearchIcon, UserRoundIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
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
import {
  type AdminRole,
  getRoleAvatarInitial,
  getRoleMemberDisplayName,
  type RoleMemberOption,
  SYSTEM_ROLE_CODES,
} from "@/lib/admin/roles";
import { cn } from "@/lib/utils";

type RoleMembersDialogProps = {
  members: readonly RoleMemberOption[];
  /** 关闭并清空查看中的角色 */
  onClose: () => void;
  /** 成员保存成功后回传最新的角色视图，用于刷新列表与弹窗内容 */
  onSaved: (role: AdminRole) => void;
  open: boolean;
  role: AdminRole | null;
};

function MemberAvatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-sm font-medium text-foreground"
    >
      {getRoleAvatarInitial(name)}
    </span>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-3 py-2.5 first:pl-0">
      <p className="text-xs leading-[18px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-[14px] leading-5 font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}

type PickerRowProps = {
  checked: boolean;
  member: RoleMemberOption;
  onToggle: (memberId: string) => void;
};

function PickerRow({ checked, member, onToggle }: PickerRowProps) {
  const displayName = getRoleMemberDisplayName(member);
  const handleClick = useCallback(
    () => onToggle(member.id),
    [member.id, onToggle]
  );

  return (
    <button
      aria-pressed={checked}
      className={cn(
        "flex w-full items-center gap-3 border-b border-border/50 px-3 py-2.5 text-left transition-colors last:border-b-0",
        checked ? "bg-muted" : "hover:bg-muted/60"
      )}
      onClick={handleClick}
      type="button"
    >
      <MemberAvatar name={displayName} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] leading-5 font-medium text-foreground">
          {displayName}
        </span>
        <span className="block truncate text-xs leading-4 text-muted-foreground">
          {member.email}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-[var(--hairline-strong)] bg-card text-transparent"
        )}
      >
        <CheckIcon className="size-3" />
      </span>
    </button>
  );
}

type MemberChipProps = {
  member: RoleMemberOption;
  onRemove: (memberId: string) => void;
  removing: boolean;
  showRemove: boolean;
};

function MemberChip({
  member,
  onRemove,
  removing,
  showRemove,
}: MemberChipProps) {
  const intl = useTranslations("admin");
  const displayName = getRoleMemberDisplayName(member);
  const handleRemoveClick = useCallback(
    () => onRemove(member.id),
    [member.id, onRemove]
  );

  return (
    <li className="flex items-center gap-2.5 rounded-[10px] border border-border bg-card py-1.5 pr-2 pl-2.5">
      <MemberAvatar name={displayName} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] leading-5 font-medium text-foreground">
          {displayName}
        </span>
        <span className="block truncate text-xs leading-4 text-muted-foreground">
          {member.email}
        </span>
      </span>
      {showRemove ? (
        <Button
          aria-label={intl("removeMember", { name: displayName })}
          className="size-7 text-muted-foreground hover:text-foreground"
          disabled={removing}
          onClick={handleRemoveClick}
          size="icon-sm"
          variant="ghost"
        >
          <XIcon className="size-4" />
        </Button>
      ) : null}
    </li>
  );
}

export function RoleMembersDialog({
  members,
  onClose,
  onSaved,
  open,
  role,
}: RoleMembersDialogProps) {
  const intl = useTranslations("admin");
  const { t } = usePreferences();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPickerOpen(false);
      setQuery("");
      setSelected(new Set(role?.memberIds ?? []));
      setSaving(false);
    }
  }, [open, role]);

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members]
  );

  const isSuperAdmin = role?.code === SYSTEM_ROLE_CODES.superAdmin;
  /** 单成员角色（超级管理员）：选择即替换，不提供逐个移除 */
  const singleMemberMode = role?.memberLimit === 1;

  const roleMembers = useMemo(() => {
    if (!role) {
      return [];
    }
    return role.memberIds
      .map((id) => memberById.get(id))
      .filter((item): item is RoleMemberOption => item !== undefined);
  }, [memberById, role]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleMembers = useMemo(() => {
    if (!normalizedQuery) {
      return members;
    }
    return members.filter((member) =>
      `${getRoleMemberDisplayName(member)} ${member.email} ${member.departmentName ?? ""}`
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    );
  }, [members, normalizedQuery]);

  const handleQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setQuery(event.currentTarget.value),
    []
  );

  const handleOpenPicker = useCallback(() => {
    setQuery("");
    setSelected(new Set(role?.memberIds ?? []));
    setPickerOpen(true);
  }, [role]);

  const handleCancelPicker = useCallback(() => setPickerOpen(false), []);

  const handleToggleMember = useCallback(
    (memberId: string) => {
      setSelected((current) => {
        const next = new Set(singleMemberMode ? [] : current);
        if (current.has(memberId) && !singleMemberMode) {
          next.delete(memberId);
        } else {
          next.add(memberId);
        }
        return next;
      });
    },
    [singleMemberMode]
  );

  const saveMembers = useCallback(
    async (memberIds: string[]) => {
      if (!role || saving) {
        return;
      }
      setSaving(true);
      try {
        const response = await fetch(`/api/admin/roles/${role.id}/members`, {
          body: JSON.stringify({ memberIds }),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        });
        const body = (await response.json().catch(() => null)) as
          | AdminRole
          | { error?: string }
          | null;
        if (!response.ok) {
          const error =
            body && "error" in body && body.error
              ? body.error
              : t("admin.somethingWentWrongTryAgainLater");
          toast.error(t(error));
          return;
        }
        const updated = body as AdminRole;
        onSaved(updated);
        setPickerOpen(false);
        toast.success(intl("roleMembersUpdated", { name: updated.name }));
      } catch {
        toast.error(t("admin.networkErrorTryAgainLater"));
      } finally {
        setSaving(false);
      }
    },
    [intl, onSaved, role, saving, t]
  );

  const handlePickerSubmit = useCallback(() => {
    saveMembers([...selected]);
  }, [saveMembers, selected]);

  const handleRemoveMember = useCallback(
    (memberId: string) => {
      if (!role) {
        return;
      }
      saveMembers(role.memberIds.filter((id) => id !== memberId));
    },
    [role, saveMembers]
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        onClose();
      }
    },
    [onClose]
  );

  if (!role) {
    return null;
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="truncate">{role.name}</span>
            <span className="shrink-0 rounded-sm bg-muted px-2 py-0.5 text-xs leading-4 font-medium text-muted-foreground">
              {t(
                role.type === "system"
                  ? "admin.systemRoleType"
                  : "admin.customRoleType"
              )}
            </span>
          </DialogTitle>
          <DialogDescription>
            {role.description ? role.description : t("admin.noDescriptionYet")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 overflow-hidden rounded-[10px] border border-border/70 bg-muted/40">
          <InfoCell
            label={t("common.type")}
            value={t(
              role.type === "system"
                ? "admin.systemRoleType"
                : "admin.customRoleType"
            )}
          />
          <InfoCell
            label={t("admin.members")}
            value={intl("memberCount", { count: roleMembers.length })}
          />
          <InfoCell
            label={t("admin.memberLimit")}
            value={
              role.memberLimit === null
                ? t("admin.unlimited")
                : intl("memberCount", { count: role.memberLimit })
            }
          />
        </div>

        <section className="min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] leading-6 font-semibold">
              {t("admin.roleMembers")}
            </h3>
            {pickerOpen ? null : (
              <Button
                disabled={saving}
                onClick={handleOpenPicker}
                size="sm"
                variant="outline"
              >
                {t("admin.selectMembers")}
              </Button>
            )}
          </div>

          {pickerOpen ? (
            <div className="mt-3 overflow-hidden rounded-[10px] border border-border bg-card">
              <div className="border-b border-border/70 p-2.5">
                {singleMemberMode ? (
                  <p className="px-1 pb-2 text-[12px] leading-5 text-muted-foreground">
                    {t("admin.thisRoleAllowsExactlyOneMemberSaving")}
                  </p>
                ) : null}
                <div className="relative">
                  <SearchIcon
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -t-y-1/2 text-muted-foreground/65"
                  />
                  <Input
                    aria-label={t("common.searchMembers")}
                    className="h-9 pl-9"
                    onChange={handleQueryChange}
                    placeholder={t("common.searchNameEmailOrDepartment")}
                    type="search"
                    value={query}
                  />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {visibleMembers.length > 0 ? (
                  visibleMembers.map((member) => (
                    <PickerRow
                      checked={selected.has(member.id)}
                      key={member.id}
                      member={member}
                      onToggle={handleToggleMember}
                    />
                  ))
                ) : (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                    {t("common.noMatchingMembers")}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border/70 px-3 py-2.5">
                <span className="text-[13px] leading-5 text-muted-foreground">
                  {singleMemberMode
                    ? selected.size === 1
                      ? t("admin.oneMemberSelected")
                      : t("admin.noMemberSelected")
                    : intl("selectedMemberCount", { count: selected.size })}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    disabled={saving}
                    onClick={handleCancelPicker}
                    size="sm"
                    variant="outline"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    disabled={saving || selected.size === 0}
                    onClick={handlePickerSubmit}
                    size="sm"
                  >
                    {saving ? t("admin.saving") : t("admin.save")}
                  </Button>
                </div>
              </div>
            </div>
          ) : roleMembers.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5">
              {roleMembers.map((member) => (
                <MemberChip
                  key={member.id}
                  member={member}
                  onRemove={handleRemoveMember}
                  removing={saving}
                  showRemove={!singleMemberMode}
                />
              ))}
            </ul>
          ) : (
            <div className="mt-3 flex min-h-20 items-center justify-center gap-2 rounded-[10px] border border-dashed border-border bg-card text-sm text-muted-foreground">
              <UserRoundIcon aria-hidden="true" className="size-4" />
              {isSuperAdmin
                ? t("admin.noSuperAdministratorAssignedYetSelectA")
                : t("admin.noMembersYetClickSelectMembersTo")}
            </div>
          )}
        </section>

        <DialogFooter className="mt-1">
          <Button onClick={onClose} variant="outline">
            {t("admin.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
