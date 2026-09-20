/**
 * 组织架构页与部门接口共用的视图模型与纯函数助手。
 * 数据来自 Department / Member 数据表，由接口层组装后下发给页面。
 */

export type Department = {
  id: string;
  /** 负责人成员 id；未设置为 null */
  leaderId: string | null;
  name: string;
  parentId: string | null;
};

export type MemberSummary = {
  departmentId: string | null;
  email: string;
  id: string;
  /** 账号姓名；旧账号可能未设置，展示时回退到邮箱 */
  name: string | null;
  title: string | null;
};

export type DepartmentNode = {
  children: DepartmentNode[];
  department: Department;
  depth: number;
};

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
  members: readonly MemberSummary[],
  departmentId: string
): number {
  if (!departments.some((item) => item.id === departmentId)) {
    return 0;
  }

  const ids = getDescendantIds(departments, departmentId);
  ids.add(departmentId);
  return members.filter((member) => ids.has(member.departmentId ?? "")).length;
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

/** 成员展示名：姓名未设置时回退到邮箱前缀 */
export function getMemberDisplayName(member: MemberSummary): string {
  if (member.name?.trim()) {
    return member.name;
  }
  return member.email.split("@")[0] || member.email;
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
