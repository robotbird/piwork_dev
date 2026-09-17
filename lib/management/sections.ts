import {
  BlocksIcon,
  BrainIcon,
  DatabaseIcon,
  type LucideIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react";

export type ManagementSection = {
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

const SKILL_SECTION: ManagementSection = {
  description: "沉淀企业级技能资产，让智能体能力可上传、可共享、可复用。",
  features: ["技能库浏览", "创建与上传", "分发复用"],
  href: "/management/skills",
  icon: BlocksIcon,
  ready: true,
  tagline: "企业技能库 · 沉淀与复用",
  title: "Skill 管理",
};

const TOOL_SECTION: ManagementSection = {
  description: "统一接入与管理 MCP 服务、API 与插件，扩展智能体的能力边界。",
  features: ["MCP 服务", "API 接入", "插件管理"],
  href: "/management/tools",
  icon: WrenchIcon,
  tagline: "MCP / API / 插件 · 接入与管理",
  title: "企业工具",
};

const DATA_SECTION: ManagementSection = {
  description: "管理企业知识库、数据库与企业文档，为智能体回答提供数据支撑。",
  features: ["知识库", "数据库", "企业文档"],
  href: "/management/data",
  icon: DatabaseIcon,
  tagline: "知识库 / 数据库 / 企业文档",
  title: "企业数据",
};

const MODEL_SECTION: ManagementSection = {
  description: "统一接入多模型与企业私有模型，管理模型的可用性与配置。",
  features: ["多模型接入", "私有模型", "接入配置"],
  href: "/management/models",
  icon: BrainIcon,
  tagline: "多模型接入 · 企业私有模型",
  title: "模型管理",
};

const ORGANIZATION_SECTION: ManagementSection = {
  description: "维护组织架构与成员，配置角色与访问权限。",
  features: ["组织架构", "成员管理", "角色与权限"],
  href: "/management/organization",
  icon: UsersIcon,
  tagline: "组织架构 / 成员管理 · 角色与权限",
  title: "组织与用户",
};

export type ManagementNavGroup = {
  /** 组内导航项 */
  items: ManagementSection[];
};

/**
 * 侧边栏导航分组：组与组之间以细分隔线区隔（参考 Codex 设置界面）。
 * 第一组为智能体能力资源，第二组为组织与账户。
 */
export const MANAGEMENT_NAV_GROUPS: ManagementNavGroup[] = [
  {
    items: [SKILL_SECTION, TOOL_SECTION, DATA_SECTION, MODEL_SECTION],
  },
  {
    items: [ORGANIZATION_SECTION],
  },
];

export const MANAGEMENT_SECTIONS: ManagementSection[] =
  MANAGEMENT_NAV_GROUPS.flatMap((group) => group.items);

export function getManagementSection(href: string): ManagementSection {
  const section = MANAGEMENT_SECTIONS.find((item) => item.href === href);

  if (!section) {
    throw new Error(`Unknown management section: ${href}`);
  }

  return section;
}
