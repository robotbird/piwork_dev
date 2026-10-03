/**
 * 成员管理页与成员接口共用的视图模型与纯函数助手。
 * 数据来自 Member / User 数据表，由接口层组装后下发给页面。
 */

export type MemberRole = "admin" | "member";

export type MemberStatus = "enabled" | "disabled";

export type AdminMember = {
  /** 添加时间（ISO 字符串），展示时经 formatStamp 格式化 */
  addedAt: string;
  departmentId: string | null;
  departmentName: string | null;
  email: string;
  id: string;
  name: string | null;
  role: MemberRole;
  status: MemberStatus;
  /** 职务（组织架构成员卡片展示） */
  title: string | null;
  /** 关联的登录账号 id，用于识别「当前登录账号」 */
  userId: string;
};

export const MEMBER_ROLE_OPTIONS: readonly {
  label: string;
  value: MemberRole;
}[] = [
  { label: "管理员", value: "admin" },
  { label: "普通成员", value: "member" },
];

export const MEMBER_STATUS_OPTIONS: readonly {
  label: string;
  value: MemberStatus;
}[] = [
  { label: "已启用", value: "enabled" },
  { label: "未启用", value: "disabled" },
];

export const ROLE_LABELS: Record<MemberRole, string> = {
  admin: "管理员",
  member: "普通成员",
};

export const STATUS_LABELS: Record<MemberStatus, string> = {
  disabled: "未启用",
  enabled: "已启用",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

/** ISO 时间戳的展示格式（2025-09-15 10:30）；仅在客户端事件里调用 */
export function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const AVATAR_TONES = [
  "bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  "bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  "bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  "bg-rose-500/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
] as const;

/** 姓名散列到固定头像配色，同一成员刷新后颜色保持不变 */
export function getAvatarTone(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/** 头像展示字：姓名首字符（中文姓氏或拉丁首字母，取大写） */
export function getAvatarInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "?";
  }
  return [...trimmed][0].toUpperCase();
}

/**
 * 判断成员是否为「最后一名已启用的管理员」；
 * 该成员不允许被停用、降级或删除，保证控制台始终有人可管理。
 */
export function isLastEnabledAdmin(
  members: readonly AdminMember[],
  member: AdminMember
): boolean {
  if (member.role !== "admin" || member.status !== "enabled") {
    return false;
  }
  return !members.some(
    (item) =>
      item.id !== member.id &&
      item.role === "admin" &&
      item.status === "enabled"
  );
}
