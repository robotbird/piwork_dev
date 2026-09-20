/**
 * 角色管理页与角色接口共用的视图模型、系统角色定义与纯函数助手。
 * 数据来自 Role / MemberRole 数据表，由接口层组装后下发给页面。
 *
 * 与旧版 Member.role（admin / member）的同步约定：
 * 成员属于「管理员」或「超级管理员」任一角色时 Member.role 为 admin，否则为 member；
 * 两个方向的写入口（成员接口、角色接口）都会维护该约定。
 */

export type RoleType = "system" | "custom";

export type ManagementRole = {
  /** 稳定标识；仅系统角色有值 */
  code: string | null;
  description: string | null;
  id: string;
  /** 成员 id 列表（详情弹窗勾选状态与成员徽章共用） */
  memberIds: string[];
  /** 成员人数上限；null 表示不限 */
  memberLimit: number | null;
  name: string;
  type: RoleType;
};

/** 角色成员选择器的候选人（来自成员列表） */
export type RoleMemberOption = {
  departmentName: string | null;
  email: string;
  id: string;
  name: string | null;
};

export type RolesView = {
  members: RoleMemberOption[];
  roles: ManagementRole[];
};

/** 系统角色 code；自定义角色不占用 */
export const SYSTEM_ROLE_CODES = {
  admin: "admin",
  auditor: "auditor",
  member: "member",
  superAdmin: "super_admin",
} as const;

/** 系统角色的种子数据（首次加载时写入数据库） */
export const SYSTEM_ROLE_SEEDS: readonly {
  code: string;
  description: string;
  memberLimit: number | null;
  name: string;
}[] = [
  {
    code: SYSTEM_ROLE_CODES.superAdmin,
    description: "拥有系统所有权限，可管理企业全部资源",
    memberLimit: 1,
    name: "超级管理员",
  },
  {
    code: SYSTEM_ROLE_CODES.admin,
    description: "可管理成员、角色、Skill 及系统资源",
    memberLimit: null,
    name: "管理员",
  },
  {
    code: SYSTEM_ROLE_CODES.member,
    description: "基础使用权限，可使用已授权的功能",
    memberLimit: null,
    name: "普通成员",
  },
  {
    code: SYSTEM_ROLE_CODES.auditor,
    description: "可查看系统日志和审计信息",
    memberLimit: null,
    name: "审计员",
  },
];

export const ROLE_TYPE_LABELS: Record<RoleType, string> = {
  custom: "自定义",
  system: "系统",
};

export function isSystemRole(role: Pick<ManagementRole, "type">): boolean {
  return role.type === "system";
}

/** 该角色的成员变动会同步影响 Member.role（admin / member） */
export function carriesAdminAccess(
  role: Pick<ManagementRole, "code">
): boolean {
  return (
    role.code === SYSTEM_ROLE_CODES.admin ||
    role.code === SYSTEM_ROLE_CODES.superAdmin
  );
}

/** 成员展示名：旧账号可能没有姓名，回退到邮箱前缀 */
export function getRoleMemberDisplayName(
  member: Pick<RoleMemberOption, "email" | "name">
): string {
  return member.name?.trim() || member.email.split("@")[0] || member.email;
}

const AVATAR_TONES = [
  "bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  "bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  "bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  "bg-rose-500/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
] as const;

/** 姓名散列到固定头像配色，同一成员刷新后颜色保持不变 */
export function getRoleAvatarTone(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/** 头像展示字：姓名首字符（中文姓氏或拉丁首字母，取大写） */
export function getRoleAvatarInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "?";
  }
  return [...trimmed][0].toUpperCase();
}

export const ROLE_NAME_MAX_LENGTH = 128;
export const ROLE_DESCRIPTION_MAX_LENGTH = 1024;
