export type SkillCategory =
  | "办公协同"
  | "开发工具"
  | "数据分析"
  | "内容创作"
  | "效率工具"
  | "知识学习";

export type CatalogSkill = {
  category: SkillCategory;
  capabilities: string[];
  description: string;
  displayName: string;
  icon: "chart" | "code" | "document" | "mail" | "presentation" | "report";
  name: string;
  source: string;
  sourceType: "official" | "enterprise";
  version: string;
};

type InstallableCatalogSkill = CatalogSkill & { instructions: string };

export const skillCategories: Array<"全部" | SkillCategory> = [
  "全部",
  "办公协同",
  "开发工具",
  "数据分析",
  "内容创作",
  "效率工具",
  "知识学习",
];

const catalog: InstallableCatalogSkill[] = [
  {
    capabilities: [
      "读取并整理 Excel / CSV 数据",
      "生成清晰的数据摘要",
      "提供可复用的分析步骤",
    ],
    category: "数据分析",
    description: "创建、清洗与分析表格数据，快速提炼关键指标和业务结论。",
    displayName: "Excel 表格处理",
    icon: "chart",
    instructions:
      "# Excel 表格处理\n\n当用户需要处理 Excel 或 CSV 数据时使用此技能。\n\n1. 先确认文件、目标字段和期望输出。\n2. 保留原始数据，基于副本完成清洗和计算。\n3. 检查公式、空值和异常值，再用清晰的表格总结结论。",
    name: "excel-workbench",
    source: "Piwork 官方",
    sourceType: "official",
    version: "1.2.0",
  },
  {
    capabilities: ["整理会议要点", "提取行动项与负责人", "生成结构化纪要"],
    category: "办公协同",
    description: "将零散会议记录整理成重点明确、可直接分发的专业纪要。",
    displayName: "会议纪要助手",
    icon: "document",
    instructions:
      "# 会议纪要助手\n\n将用户提供的会议记录整理为简洁纪要。\n\n输出会议主题、关键结论、待办事项、负责人和截止时间。不要补写来源中不存在的决定。",
    name: "meeting-notes",
    source: "Piwork 官方",
    sourceType: "official",
    version: "1.4.1",
  },
  {
    capabilities: ["汇总本周工作", "识别风险与阻塞", "生成下周计划"],
    category: "办公协同",
    description: "汇总团队成员进展，生成聚焦成果、风险与计划的结构化周报。",
    displayName: "团队周报",
    icon: "report",
    instructions:
      "# 团队周报\n\n汇总用户提供的团队周报。按成果、进行中事项、风险与支持、下周计划组织内容，合并重复事项并保留负责人。",
    name: "weekly-report",
    source: "企业数字化中心",
    sourceType: "enterprise",
    version: "2.1.0",
  },
  {
    capabilities: ["生成演示结构", "优化页面叙事", "检查内容完整性"],
    category: "内容创作",
    description: "从提纲或材料生成条理清晰的演示文稿结构与逐页内容。",
    displayName: "PPT 演示文稿",
    icon: "presentation",
    instructions:
      "# PPT 演示文稿\n\n帮助用户规划演示文稿。先确认受众、场景与时长，再输出叙事主线、页级标题、要点和演讲提示。",
    name: "presentation-planner",
    source: "品牌与市场部",
    sourceType: "enterprise",
    version: "1.3.0",
  },
  {
    capabilities: ["解释代码与错误", "提出最小修改方案", "生成验证清单"],
    category: "开发工具",
    description: "协助定位代码问题、解释根因，并给出可验证的修复建议。",
    displayName: "代码诊断助手",
    icon: "code",
    instructions:
      "# 代码诊断助手\n\n用于代码诊断。先复现并收集证据，明确根因后再提出最小修复方案；修改后运行与风险匹配的测试。",
    name: "code-diagnostics",
    source: "研发效能团队",
    sourceType: "enterprise",
    version: "1.1.2",
  },
  {
    capabilities: ["提炼长文重点", "保留关键事实", "按受众调整表达"],
    category: "知识学习",
    description: "将长文、报告或学习资料压缩为清晰摘要和可行动的知识卡片。",
    displayName: "长文精读",
    icon: "document",
    instructions:
      "# 长文精读\n\n阅读用户提供的材料，区分事实、观点和推论，输出摘要、关键证据、术语解释与可继续追问的问题。",
    name: "deep-reading",
    source: "Piwork 官方",
    sourceType: "official",
    version: "1.0.3",
  },
  {
    capabilities: ["生成邮件初稿", "调整语气与长度", "提取待确认信息"],
    category: "效率工具",
    description: "根据沟通目标快速生成得体、简洁并带有明确行动点的邮件。",
    displayName: "商务邮件助手",
    icon: "mail",
    instructions:
      "# 商务邮件助手\n\n根据用户提供的对象、背景和目标起草邮件。保持语气自然、行动点明确；缺失的重要事实使用占位符，不要自行虚构。",
    name: "business-email",
    source: "Piwork 官方",
    sourceType: "official",
    version: "1.0.6",
  },
  {
    capabilities: ["设计结构化图表", "梳理节点关系", "输出可编辑图形"],
    category: "内容创作",
    description: "将复杂流程与架构整理为结构清楚、易维护的可编辑图表。",
    displayName: "Draw.io 图表生成",
    icon: "chart",
    instructions:
      "# Draw.io 图表生成\n\n将用户的流程、架构或关系描述转为结构化图表方案。先明确节点层级与连线语义，再生成可编辑内容并检查标签可读性。",
    name: "drawio-to-pptx",
    source: "企业架构组",
    sourceType: "enterprise",
    version: "1.5.0",
  },
];

export const publicSkillCatalog: CatalogSkill[] = catalog.map(
  ({ instructions: _instructions, ...skill }) => skill
);

export function getInstallableCatalogSkill(name: string) {
  return catalog.find((skill) => skill.name === name) ?? null;
}
