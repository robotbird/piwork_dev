"use client";

import { KeyRoundIcon, PencilIcon, PlusIcon } from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
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
  isLastEnabledAdmin,
  isValidEmail,
  type ManagementMember,
  MEMBER_ROLE_OPTIONS,
  MEMBER_STATUS_OPTIONS,
  type MemberRole,
  type MemberStatus,
} from "@/lib/management/members";

/** Select 组件不接受空字符串值，未分配部门用哨兵值表示 */
const NONE_DEPARTMENT = "__none__";

const MIN_PASSWORD_LENGTH = 6;

export type MemberFormValues = {
  departmentId: string | null;
  email: string;
  name: string;
  /** 仅创建时提供：成员的初始登录密码 */
  password: string;
  role: MemberRole;
  status: MemberStatus;
  title: string | null;
};

export type DepartmentOption = {
  id: string;
  name: string;
};

type FieldName = "email" | "name" | "password" | "role";

type MemberDialogProps = {
  /** 待编辑成员；null 表示新建 */
  member: ManagementMember | null;
  /** 现有成员列表，用于邮箱唯一性与最后一名管理员校验 */
  members: readonly ManagementMember[];
  /** 当前登录账号（User 表）id，用于自我保护校验 */
  currentUserId: string | null;
  /** 可选部门（来自数据库） */
  departments: readonly DepartmentOption[];
  onClose: () => void;
  onSubmit: (values: MemberFormValues) => void;
  open: boolean;
};

export function MemberDialog({
  member,
  members,
  currentUserId,
  departments,
  onClose,
  onSubmit,
  open,
}: MemberDialogProps) {
  const isEdit = member !== null;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState<string>(NONE_DEPARTMENT);
  const [role, setRole] = useState<MemberRole>("member");
  const [status, setStatus] = useState<MemberStatus>("enabled");
  const [error, setError] = useState<{
    field: FieldName;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setName(member?.name ?? "");
      setEmail(member?.email ?? "");
      setPassword("");
      setTitle(member?.title ?? "");
      setDepartmentId(member?.departmentId ?? NONE_DEPARTMENT);
      setRole(member?.role ?? "member");
      setStatus(member?.status ?? "enabled");
      setError(null);
    }
  }, [member, open]);

  /** 编辑对象是最后一名已启用的管理员时，不允许降级或停用 */
  const lockedAsEnabledAdmin =
    member !== null && isLastEnabledAdmin(members, member);
  /** 编辑自己时不能停用，避免把自己锁在管理控制台之外 */
  const isSelf = member !== null && member.userId === currentUserId;

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      const trimmedTitle = title.trim();

      if (!trimmedName) {
        setError({ field: "name", message: "请输入成员姓名" });
        return;
      }
      if (!trimmedEmail) {
        setError({ field: "email", message: "请输入邮箱地址" });
        return;
      }
      if (!isValidEmail(trimmedEmail)) {
        setError({ field: "email", message: "邮箱格式不正确" });
        return;
      }
      const duplicated = members.some(
        (item) => item.id !== member?.id && item.email === trimmedEmail
      );
      if (duplicated) {
        setError({ field: "email", message: "该邮箱已被其他成员使用" });
        return;
      }
      if (!isEdit && password.length < MIN_PASSWORD_LENGTH) {
        setError({
          field: "password",
          message: `初始密码至少 ${MIN_PASSWORD_LENGTH} 位`,
        });
        return;
      }
      if (lockedAsEnabledAdmin && (role !== "admin" || status !== "enabled")) {
        setError({
          field: "role",
          message: "需保留至少一名已启用的管理员，无法降级或停用该成员",
        });
        return;
      }
      if (isSelf && status === "disabled") {
        setError({
          field: "role",
          message: "不能停用当前登录的账号",
        });
        return;
      }

      onSubmit({
        departmentId: departmentId === NONE_DEPARTMENT ? null : departmentId,
        email: trimmedEmail,
        name: trimmedName,
        password,
        role,
        status: isEdit ? status : "enabled",
        title: trimmedTitle || null,
      });
    },
    [
      departmentId,
      email,
      isEdit,
      isSelf,
      lockedAsEnabledAdmin,
      member,
      members,
      name,
      onSubmit,
      password,
      role,
      status,
      title,
    ]
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

  const handleEmailChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setEmail(event.currentTarget.value);
      if (error?.field === "email") {
        setError(null);
      }
    },
    [error]
  );

  const handlePasswordChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setPassword(event.currentTarget.value);
      if (error?.field === "password") {
        setError(null);
      }
    },
    [error]
  );

  const handleTitleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setTitle(event.currentTarget.value),
    []
  );

  const handleRoleChange = useCallback(
    (value: string) => {
      setRole(value as MemberRole);
      if (error?.field === "role") {
        setError(null);
      }
    },
    [error]
  );

  const handleStatusChange = useCallback((value: string) => {
    setStatus(value as MemberStatus);
  }, []);

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
          <DialogTitle>{isEdit ? "编辑成员" : "添加成员"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "调整成员信息。部门与角色的变化会同步影响其可访问的管理能力。"
              : "新增团队成员，创建后成员即可使用邮箱与初始密码登录。"}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="member-name">姓名</Label>
              <Input
                aria-describedby={
                  error?.field === "name" ? "member-name-error" : undefined
                }
                aria-invalid={error?.field === "name" ? true : undefined}
                id="member-name"
                onChange={handleNameChange}
                placeholder="例如：王小明"
                value={name}
              />
              {error?.field === "name" ? (
                <p
                  className="text-[13px] leading-5 text-destructive"
                  id="member-name-error"
                >
                  {error.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="member-title">职务</Label>
              <Input
                id="member-title"
                onChange={handleTitleChange}
                placeholder="选填，例如：产品经理"
                value={title}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="member-email">邮箱</Label>
            <Input
              aria-describedby={
                error?.field === "email" ? "member-email-error" : undefined
              }
              aria-invalid={error?.field === "email" ? true : undefined}
              id="member-email"
              onChange={handleEmailChange}
              placeholder="name@company.com"
              type="email"
              value={email}
            />
            {error?.field === "email" ? (
              <p
                className="text-[13px] leading-5 text-destructive"
                id="member-email-error"
              >
                {error.message}
              </p>
            ) : null}
          </div>

          {isEdit ? null : (
            <div className="grid gap-2">
              <Label htmlFor="member-password">初始密码</Label>
              <div className="relative">
                <KeyRoundIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/65"
                />
                <Input
                  aria-describedby={
                    error?.field === "password"
                      ? "member-password-error"
                      : undefined
                  }
                  aria-invalid={error?.field === "password" ? true : undefined}
                  className="pl-9"
                  id="member-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  onChange={handlePasswordChange}
                  placeholder={`至少 ${MIN_PASSWORD_LENGTH} 位`}
                  type="password"
                  value={password}
                />
              </div>
              {error?.field === "password" ? (
                <p
                  className="text-[13px] leading-5 text-destructive"
                  id="member-password-error"
                >
                  {error.message}
                </p>
              ) : (
                <p className="text-[12px] leading-5 text-muted-foreground">
                  创建后成员即可使用邮箱与该密码登录
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="member-department">部门</Label>
              <Select onValueChange={setDepartmentId} value={departmentId}>
                <SelectTrigger className="w-full" id="member-department">
                  <SelectValue placeholder="选择部门" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NONE_DEPARTMENT}>未分配</SelectItem>
                  {departments.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="member-role">角色</Label>
              <Select onValueChange={handleRoleChange} value={role}>
                <SelectTrigger
                  aria-describedby={
                    error?.field === "role" ? "member-role-error" : undefined
                  }
                  className="w-full"
                  id="member-role"
                >
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_ROLE_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isEdit ? (
            <div className="grid gap-2">
              <Label htmlFor="member-status">账号状态</Label>
              <Select
                disabled={lockedAsEnabledAdmin || isSelf}
                onValueChange={handleStatusChange}
                value={status}
              >
                <SelectTrigger className="w-full" id="member-status">
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_STATUS_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lockedAsEnabledAdmin ? (
                <p className="text-[12px] leading-5 text-muted-foreground">
                  最后一名已启用的管理员，无法停用
                </p>
              ) : isSelf ? (
                <p className="text-[12px] leading-5 text-muted-foreground">
                  不能停用当前登录的账号
                </p>
              ) : null}
            </div>
          ) : null}

          {error?.field === "role" ? (
            <p
              className="text-[13px] leading-5 text-destructive"
              id="member-role-error"
            >
              {error.message}
            </p>
          ) : null}

          <DialogFooter className="mt-1">
            <Button onClick={onClose} type="button" variant="outline">
              取消
            </Button>
            <Button type="submit">
              {isEdit ? (
                <PencilIcon data-icon="inline-start" />
              ) : (
                <PlusIcon data-icon="inline-start" />
              )}
              {isEdit ? "保存更改" : "添加成员"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
