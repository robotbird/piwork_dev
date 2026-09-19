export type MemberRole = "admin" | "member";

export type MemberStatus = "enabled" | "disabled";

export type ManagementMember = {
  /** 添加时间，展示格式「2025-09-15 10:30」；字符串可直接按字典序比较排序 */
  addedAt: string;
  department: string;
  email: string;
  id: string;
  name: string;
  role: MemberRole;
  status: MemberStatus;
};

/** 成员可归属的部门选项（添加 / 编辑弹窗与筛选共用） */
export const MEMBER_DEPARTMENTS = [
  "产品部",
  "技术部",
  "设计部",
  "市场部",
  "人力资源部",
  "财务部",
] as const;

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

/** 当前时间的展示格式时间戳；仅在客户端事件里调用，不参与服务端渲染 */
export function nowStamp(): string {
  return formatStamp(new Date());
}

export function formatStamp(date: Date): string {
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
 * 成员管理演示数据：与参考界面一致 —— 前 5 名为设计稿中的成员，
 * 统计卡数字（总数 24 / 已启用 21 / 未启用 3）由列表实时计算得出。
 */
export const SEED_MEMBERS: ManagementMember[] = [
  {
    addedAt: "2025-09-15 10:30",
    department: "产品部",
    email: "admin@company.com",
    id: "member-wangxiaoming",
    name: "王小明",
    role: "admin",
    status: "enabled",
  },
  {
    addedAt: "2025-09-14 09:15",
    department: "技术部",
    email: "lihua@company.com",
    id: "member-lihua",
    name: "李华",
    role: "member",
    status: "enabled",
  },
  {
    addedAt: "2025-09-12 14:20",
    department: "设计部",
    email: "zhangsan@company.com",
    id: "member-zhangsan",
    name: "张三",
    role: "member",
    status: "enabled",
  },
  {
    addedAt: "2025-09-10 11:05",
    department: "市场部",
    email: "zhaoliu@company.com",
    id: "member-zhaoliu",
    name: "赵六",
    role: "member",
    status: "disabled",
  },
  {
    addedAt: "2025-09-08 16:45",
    department: "技术部",
    email: "chenqi@company.com",
    id: "member-chenqi",
    name: "陈七",
    role: "member",
    status: "enabled",
  },
  {
    addedAt: "2025-09-06 09:40",
    department: "产品部",
    email: "zhouting@company.com",
    id: "member-zhouting",
    name: "周婷",
    role: "admin",
    status: "enabled",
  },
  {
    addedAt: "2025-09-05 15:20",
    department: "技术部",
    email: "wujing@company.com",
    id: "member-wujing",
    name: "吴静",
    role: "member",
    status: "enabled",
  },
  {
    addedAt: "2025-09-03 10:10",
    department: "设计部",
    email: "zhenghao@company.com",
    id: "member-zhenghao",
    name: "郑浩",
    role: "member",
    status: "enabled",
  },
  {
    addedAt: "2025-09-01 13:55",
    department: "市场部",
    email: "sunyue@company.com",
    id: "member-sunyue",
    name: "孙悦",
    role: "member",
    status: "enabled",
  },
  {
    addedAt: "2025-08-29 09:30",
    department: "技术部",
    email: "linfeng@company.com",
    id: "member-linfeng",
    name: "林峰",
    role: "member",
    status: "enabled",
  },
  {
    addedAt: "2025-08-27 17:05",
    department: "产品部",
    email: "heyu@company.com",
    id: "member-heyu",
    name: "何雨",
    role: "member",
    status: "enabled",
  },
  {
    addedAt: "2025-08-25 11:45",
    department: "人力资源部",
    email: "gaoyuan@company.com",
    id: "member-gaoyuan",
    name: "高远",
    role: "member",
    status: "enabled",
  },
  {
    addedAt: "2025-08-23 14:30",
    department: "财务部",
    email: "xulei@company.com",
    id: "member-xulei",
    name: "徐蕾",
    role: "member",
    status: "enabled",
  },
  {
    addedAt: "2025-08-21 10:50",
    department: "技术部",
    email: "maliang@company.com",
    id: "member-maliang",
    name: "马亮",
    role: "member",
    status: "disabled",
  },
  {
    addedAt: "2025-08-19 16:15",
    department: "设计部",
    email: "hanxue@company.com",
    id: "member-hanxue",
    name: "韩雪",
    role: "member",
    status: "enabled",
  },
  {
    addedAt: "2025-08-17 09:25",
    department: "市场部",
    email: "shenchuan@company.com",
    id: "member-shenchuan",
    name: "沈川",
    role: "member",
    status: "enabled",
  },
  {
    addedAt: "2025-08-15 15:40",
    department: "产品部",
    email: "songjia@company.com",
    id: "member-songjia",
    name: "宋佳",
    role: "member",
    status: "enabled",
  },
  {
    addedAt: "2025-08-13 10:35",
    department: "技术部",
    email: "tanglei@company.com",
    id: "member-tanglei",
    name: "唐磊",
    role: "member",
    status: "enabled",
  },
  {
    addedAt: "2025-08-11 14:05",
    department: "人力资源部",
    email: "fengrui@company.com",
    id: "member-fengrui",
    name: "冯蕊",
    role: "member",
    status: "enabled",
  },
  {
    addedAt: "2025-08-09 11:20",
    department: "财务部",
    email: "caoyang@company.com",
    id: "member-caoyang",
    name: "曹阳",
    role: "member",
    status: "disabled",
  },
  {
    addedAt: "2025-08-07 09:55",
    department: "市场部",
    email: "xiefeng@company.com",
    id: "member-xiefeng",
    name: "谢峰",
    role: "member",
    status: "enabled",
  },
  {
    addedAt: "2025-08-05 16:30",
    department: "设计部",
    email: "dengqi@company.com",
    id: "member-dengqi",
    name: "邓琪",
    role: "member",
    status: "enabled",
  },
  {
    addedAt: "2025-08-03 10:45",
    department: "技术部",
    email: "dongxuan@company.com",
    id: "member-dongxuan",
    name: "董轩",
    role: "member",
    status: "enabled",
  },
  {
    addedAt: "2025-08-01 13:15",
    department: "产品部",
    email: "yuanyuan@company.com",
    id: "member-yuanyuan",
    name: "袁媛",
    role: "member",
    status: "enabled",
  },
];

/**
 * 判断成员是否为「最后一名已启用的管理员」；
 * 该成员不允许被停用、降级或删除，保证控制台始终有人可管理。
 */
export function isLastEnabledAdmin(
  members: readonly ManagementMember[],
  member: ManagementMember
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
