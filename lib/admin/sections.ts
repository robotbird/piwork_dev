import {
  BlocksIcon,
  BrainIcon,
  DatabaseIcon,
  type LucideIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react";

export type AdminSection = {
  /** 路由路径，同时作为导航激活匹配前缀 */
  href: string;
  /** 分类名称 */
  title: string;
  /** 一句话简介（截图中的副标题） */
  tagline: string;
  /** 详细描述（占位阶段文案，后续可替换为各模块真实说明） */
  description: string;
  icon: LucideIcon;
  /** 该分类下的子能力占位 */
  features: string[];
  /** 是否已有实现 */
  ready?: boolean;
};

const SKILL_SECTION: AdminSection = {
  description: "admin.sectionSkillsDescription",
  features: ["admin.browseSkills", "admin.createUpload", "admin.reuse"],
  href: "/admin/skills",
  icon: BlocksIcon,
  ready: true,
  tagline: "admin.skillsTagline",
  title: "adminSidebar.skillManagement",
};

const TOOL_SECTION: AdminSection = {
  description: "admin.toolsDescription",
  features: [
    "adminSidebar.mcpServices",
    "admin.apiIntegration",
    "admin.plugins",
  ],
  href: "/admin/tools",
  icon: WrenchIcon,
  ready: true,
  tagline: "admin.toolsTagline",
  title: "admin.toolsManagementTitle",
};

const DATA_SECTION: AdminSection = {
  description: "admin.dataDescription",
  features: ["admin.knowledge", "admin.databases", "admin.enterpriseDocuments"],
  href: "/admin/data",
  icon: DatabaseIcon,
  tagline: "admin.dataTagline",
  title: "adminSidebar.dataManagement",
};

const MODEL_SECTION: AdminSection = {
  description: "admin.modelsDescription",
  features: [
    "admin.multiModel",
    "admin.privateModels",
    "admin.modelConfiguration",
  ],
  href: "/admin/models",
  icon: BrainIcon,
  ready: true,
  tagline: "admin.modelsTagline",
  title: "adminSidebar.modelManagement",
};

const ORGANIZATION_SECTION: AdminSection = {
  description: "admin.organizationDescription",
  features: [
    "adminSidebar.organization",
    "adminSidebar.members",
    "adminSidebar.rolesAndPermissions",
  ],
  href: "/admin/organization",
  icon: UsersIcon,
  tagline: "admin.organizationTagline",
  title: "admin.organizationUsers",
};

export type AdminNavGroup = {
  /** 组内导航项 */
  items: AdminSection[];
};

/**
 * 侧边栏导航分组：组与组之间以细分隔线区隔（参考 Codex 设置界面）。
 * 第一组为智能体能力资源，第二组为组织与账户。
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    items: [SKILL_SECTION, TOOL_SECTION, DATA_SECTION, MODEL_SECTION],
  },
  {
    items: [ORGANIZATION_SECTION],
  },
];

export const ADMIN_SECTIONS: AdminSection[] = ADMIN_NAV_GROUPS.flatMap(
  (group) => group.items
);

export function getAdminSection(href: string): AdminSection {
  const section = ADMIN_SECTIONS.find((item) => item.href === href);

  if (!section) {
    throw new Error(`Unknown management section: ${href}`);
  }

  return section;
}
