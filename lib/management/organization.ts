export type OrganizationMember = {
  id: string;
  name: string;
  title: string;
};

export type Department = {
  id: string;
  leader: string | null;
  members: OrganizationMember[];
  name: string;
  parentId: string | null;
};

export type DepartmentNode = {
  children: DepartmentNode[];
  department: Department;
  depth: number;
};

function member(id: string, name: string, title: string): OrganizationMember {
  return { id, name, title };
}

/**
 * 组织架构演示数据：结构与参考界面一致（东航资产 → 三大部门 → 数字化部下设两组）。
 * 徽章展示的成员数为该部门含下级的总数，与详情面板保持一致。
 */
export const SEED_DEPARTMENTS: Department[] = [
  {
    id: "hq",
    leader: "王建国",
    members: [
      member("hq-m1", "王建国", "总经理"),
      member("hq-m2", "苏雯", "副总经理"),
    ],
    name: "东航资产",
    parentId: null,
  },
  {
    id: "general-admin",
    leader: "赵磊",
    members: [
      member("general-admin-m1", "赵磊", "部门总监"),
      member("general-admin-m2", "周敏", "行政主管"),
      member("general-admin-m3", "吴倩", "招聘经理"),
      member("general-admin-m4", "郑强", "法务专员"),
      member("general-admin-m5", "冯婷", "前台接待"),
      member("general-admin-m6", "蒋华", "采购专员"),
      member("general-admin-m7", "韩雪", "培训主管"),
      member("general-admin-m8", "秦峰", "后勤专员"),
    ],
    name: "综合管理部",
    parentId: "hq",
  },
  {
    id: "finance",
    leader: "孙浩",
    members: [
      member("finance-m1", "孙浩", "财务总监"),
      member("finance-m2", "马丽", "会计主管"),
      member("finance-m3", "朱琳", "成本会计"),
      member("finance-m4", "胡军", "资金专员"),
      member("finance-m5", "郭涛", "税务专员"),
      member("finance-m6", "何静", "出纳"),
    ],
    name: "财务部",
    parentId: "hq",
  },
  {
    id: "digital",
    leader: "张明",
    members: [
      member("digital-m1", "张明", "部门总监"),
      member("digital-m2", "李思", "高级产品经理"),
      member("digital-m3", "陈浩", "算法工程师"),
    ],
    name: "数字化部",
    parentId: "hq",
  },
  {
    id: "ai-platform",
    leader: "罗宇",
    members: [
      member("ai-platform-m1", "罗宇", "平台组长"),
      member("ai-platform-m2", "高翔", "机器学习工程师"),
      member("ai-platform-m3", "林悦", "数据工程师"),
      member("ai-platform-m4", "徐亮", "后端工程师"),
      member("ai-platform-m5", "段飞", "运维工程师"),
    ],
    name: "AI 平台组",
    parentId: "digital",
  },
  {
    id: "product",
    leader: "许倩",
    members: [
      member("product-m1", "许倩", "产品组长"),
      member("product-m2", "王磊", "产品经理"),
      member("product-m3", "唐蕊", "交互设计师"),
      member("product-m4", "沈鑫", "用户研究员"),
      member("product-m5", "邹明", "数据分析师"),
      member("product-m6", "贺佳", "内容运营"),
      member("product-m7", "龙腾", "前端工程师"),
    ],
    name: "产品组",
    parentId: "digital",
  },
];

export function buildDepartmentTree(
  departments: Department[]
): DepartmentNode[] {
  const byId = new Map(
    departments.map((department) => [department.id, department])
  );
  const nodesById = new Map<string, DepartmentNode>();

  for (const department of departments) {
    nodesById.set(department.id, { children: [], department, depth: 0 });
  }

  /** 沿 parentId 链向上查找候选 id；带已访问集合，环状数据也能安全终止 */
  const reachesAncestor = (ancestorId: string, start: Department): boolean => {
    const visited = new Set<string>();
    let cursor: Department | undefined = start;
    while (cursor && !visited.has(cursor.id)) {
      if (cursor.id === ancestorId) {
        return true;
      }
      visited.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return false;
  };

  const roots: DepartmentNode[] = [];
  for (const node of nodesById.values()) {
    const { department } = node;
    const parentNode =
      department.parentId === null
        ? undefined
        : nodesById.get(department.parentId);
    // 父部门不存在时按根节点处理；父部门的祖先链回到自身（成环）时同样提升为根，
    // 保证环状数据下节点仍然可见且树本身无环
    if (!parentNode || reachesAncestor(department.id, parentNode.department)) {
      roots.push(node);
    } else {
      parentNode.children.push(node);
    }
  }

  const assignDepth = (nodes: DepartmentNode[], depth: number) => {
    for (const node of nodes) {
      node.depth = depth;
      assignDepth(node.children, depth + 1);
    }
  };

  assignDepth(roots, 0);
  return roots;
}

/** 含下级部门的成员总数（树节点徽章与详情页「成员数量」共用）；环状数据不会死循环 */
export function countSubtreeMembers(
  departments: Department[],
  departmentId: string
): number {
  const root = departments.find((item) => item.id === departmentId);
  if (!root) {
    return 0;
  }

  const childrenByParent = buildChildrenByParent(departments);
  let total = root.members.length;
  // 显式栈遍历代替递归，深层级与环状数据都不会栈溢出
  const visited = new Set<string>([departmentId]);
  const stack = [...(childrenByParent.get(departmentId) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current.id)) {
      continue;
    }
    visited.add(current.id);
    total += current.members.length;
    stack.push(...(childrenByParent.get(current.id) ?? []));
  }

  return total;
}

/** 形如「东航资产 / 数字化部」的完整路径，用于上级部门展示与选择器；环状数据不会死循环 */
export function getDepartmentPathLabel(
  departments: Department[],
  departmentId: string
): string {
  const byId = new Map(departments.map((item) => [item.id, item]));
  const segments: string[] = [];
  const visited = new Set<string>();
  let cursor = byId.get(departmentId);

  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    segments.unshift(cursor.name);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  return segments.join(" / ");
}

/** 全部后代部门 id，不含自身（编辑时用于排除非法上级选项）；环状数据不会死循环 */
export function getDescendantIds(
  departments: Department[],
  departmentId: string
): Set<string> {
  const childrenByParent = buildChildrenByParent(departments);
  const ids = new Set<string>();
  const stack = [...(childrenByParent.get(departmentId) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || ids.has(current.id)) {
      continue;
    }
    ids.add(current.id);
    stack.push(...(childrenByParent.get(current.id) ?? []));
  }

  return ids;
}

function buildChildrenByParent(
  departments: Department[]
): Map<string | null, Department[]> {
  const childrenByParent = new Map<string | null, Department[]>();
  for (const department of departments) {
    const siblings = childrenByParent.get(department.parentId) ?? [];
    siblings.push(department);
    childrenByParent.set(department.parentId, siblings);
  }
  return childrenByParent;
}
