"use client";

import {
  Building2Icon,
  ChevronRightIcon,
  ChevronUpIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
} from "lucide-react";
import {
  type ChangeEvent,
  Fragment,
  useCallback,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import {
  DepartmentDialog,
  type DepartmentFormValues,
} from "@/components/management/organization/department-dialog";
import { usePreferences } from "@/components/preferences-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildDepartmentTree,
  countSubtreeMembers,
  type Department,
  type DepartmentNode,
  getMemberDisplayName,
  type MemberSummary,
} from "@/lib/management/organization";
import { cn } from "@/lib/utils";

/** 成员超过该数量时折叠，显示「···」展开按钮 */
const MEMBER_PREVIEW_COUNT = 5;

type OrganizationData = {
  departments: Department[];
  members: MemberSummary[];
};

type DepartmentRowProps = {
  department: Department;
  expanded: boolean;
  hasChildren: boolean;
  memberTotal: number;
  selected: boolean;
  onSelect: (department: Department) => void;
  onToggle: (departmentId: string) => void;
};

function DepartmentRow({
  department,
  expanded,
  hasChildren,
  memberTotal,
  selected,
  onSelect,
  onToggle,
}: DepartmentRowProps) {
  const { t } = usePreferences();
  const handleClick = useCallback(() => {
    onSelect(department);
    if (hasChildren) {
      onToggle(department.id);
    }
  }, [department, hasChildren, onSelect, onToggle]);

  return (
    <button
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={selected}
      className={cn(
        "flex h-10 w-full min-w-0 items-center gap-1.5 rounded-[10px] pr-2 pl-1.5 text-left transition-colors duration-150 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-1 focus-visible:ring-offset-card",
        selected
          ? "bg-accent text-accent-foreground"
          : "text-foreground hover:bg-muted"
      )}
      onClick={handleClick}
      role="treeitem"
      type="button"
    >
      {hasChildren ? (
        <ChevronRightIcon
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
            expanded && "rotate-90"
          )}
        />
      ) : (
        <span aria-hidden="true" className="size-4 shrink-0" />
      )}
      <Building2Icon
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 flex-1 truncate text-[14px] leading-5">
        {t(department.name)}
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-xs leading-4 font-normal",
          selected
            ? "bg-card text-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {memberTotal}
      </span>
    </button>
  );
}

type MemberChipProps = {
  isLeader: boolean;
  member: MemberSummary;
};

function MemberChip({ isLeader, member }: MemberChipProps) {
  const { t } = usePreferences();
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-border bg-card py-2 pr-3.5 pl-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <UserIcon aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[14px] leading-5 font-medium text-foreground">
            {getMemberDisplayName(member)}
          </span>
          {isLeader ? (
            <span className="shrink-0 rounded-full bg-link-soft px-1.5 py-0.5 text-[10px] leading-4 font-medium text-link-deep">
              {t("负责人")}
            </span>
          ) : null}
        </span>
        <span className="block truncate text-xs leading-4 text-muted-foreground">
          {member.title ? t(member.title) : "—"}
        </span>
      </span>
    </div>
  );
}

async function requestJson(
  url: string,
  init: RequestInit
): Promise<{ data?: unknown; error?: string }> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!response.ok) {
      return { error: body?.error ?? "操作失败，请稍后重试" };
    }
    return { data: body };
  } catch {
    return { error: "网络异常，请稍后重试" };
  }
}

export function OrganizationPage({
  initialData,
}: {
  /** 服务端直出的部门树与成员概要，变更后经接口刷新 */
  initialData: OrganizationData;
}) {
  const { t } = usePreferences();
  const [departments, setDepartments] = useState<Department[]>(
    initialData.departments
  );
  const [members, setMembers] = useState<MemberSummary[]>(initialData.members);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialData.departments.find((item) => item.parentId === null)?.id ?? null
  );
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        initialData.departments
          .filter((item) => item.parentId === null)
          .map((item) => item.id)
      )
  );
  const [query, setQuery] = useState("");
  /** 成员被展开显示的部门 id；切换部门后自动失效 */
  const [expandedMembersId, setExpandedMembersId] = useState<string | null>(
    null
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async (): Promise<OrganizationData | null> => {
    try {
      const response = await fetch("/api/management/organization", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("failed to load organization data");
      }
      const data = (await response.json()) as OrganizationData;
      setDepartments(data.departments);
      setMembers(data.members);
      setLoadFailed(false);
      return data;
    } catch {
      setLoadFailed(true);
      return null;
    }
  }, []);

  const handleRetry = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const isSearching = normalizedQuery.length > 0;

  const departmentById = useMemo(
    () => new Map(departments.map((department) => [department.id, department])),
    [departments]
  );

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members]
  );

  const memberTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const department of departments) {
      totals.set(
        department.id,
        countSubtreeMembers(departments, members, department.id)
      );
    }
    return totals;
  }, [departments, members]);

  /** 搜索时仅保留命中的部门及其祖先 */
  const visibleIds = useMemo(() => {
    if (!isSearching) {
      return null;
    }
    const visible = new Set<string>();
    for (const department of departments) {
      if (department.name.toLocaleLowerCase().includes(normalizedQuery)) {
        let cursor: Department | undefined = department;
        while (cursor && !visible.has(cursor.id)) {
          visible.add(cursor.id);
          cursor = cursor.parentId
            ? departmentById.get(cursor.parentId)
            : undefined;
        }
      }
    }
    return visible;
  }, [departmentById, departments, isSearching, normalizedQuery]);

  const tree = useMemo(() => buildDepartmentTree(departments), [departments]);

  const directMemberCount = useCallback(
    (departmentId: string) =>
      members.filter((item) => item.departmentId === departmentId).length,
    [members]
  );

  const selectedDepartment = selectedId
    ? departmentById.get(selectedId)
    : undefined;

  const handleQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setQuery(event.currentTarget.value),
    []
  );

  const handleSelect = useCallback((department: Department) => {
    setSelectedId(department.id);
  }, []);

  const handleToggle = useCallback((departmentId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(departmentId)) {
        next.delete(departmentId);
      } else {
        next.add(departmentId);
      }
      return next;
    });
  }, []);

  const handleCreateSubmit = useCallback(
    async (values: DepartmentFormValues) => {
      const { data, error } = await requestJson(
        "/api/management/organization",
        {
          body: JSON.stringify(values),
          method: "POST",
        }
      );
      if (error || !data) {
        toast.error(t(error ?? "创建部门失败"));
        return;
      }
      const created = data as Department;
      const fresh = await refresh();
      if (created.parentId && fresh) {
        const { parentId } = created;
        setExpandedIds((current) => new Set(current).add(parentId));
      }
      setSelectedId(created.id);
      setCreateOpen(false);
      toast.success(t("已创建部门「{name}」", { name: values.name }));
    },
    [refresh, t]
  );

  const handleUpdateSubmit = useCallback(
    async (values: DepartmentFormValues) => {
      if (!editingDepartment) {
        return;
      }
      const targetId = editingDepartment.id;
      const { error } = await requestJson("/api/management/organization", {
        body: JSON.stringify({ id: targetId, ...values }),
        method: "PATCH",
      });
      if (error) {
        toast.error(t(error));
        return;
      }
      if (values.parentId) {
        const { parentId } = values;
        setExpandedIds((current) => new Set(current).add(parentId));
      }
      await refresh();
      setEditingDepartment(null);
      toast.success(t("已更新部门「{name}」", { name: values.name }));
    },
    [editingDepartment, refresh, t]
  );

  const handleDeleteRequest = useCallback((department: Department) => {
    setEditingDepartment(null);
    setDeleteTarget(department);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget || deleting) {
      return;
    }
    const { id, name, parentId } = deleteTarget;
    setDeleting(true);
    const { error } = await requestJson("/api/management/organization", {
      body: JSON.stringify({ id }),
      method: "DELETE",
    });
    setDeleting(false);
    if (error) {
      toast.error(t(error));
      setDeleteTarget(null);
      return;
    }
    const fresh = await refresh();
    setExpandedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    if (selectedId === id) {
      const fallback =
        parentId && fresh?.departments.some((item) => item.id === parentId)
          ? parentId
          : (fresh?.departments.find((item) => item.parentId === null)?.id ??
            null);
      setSelectedId(fallback);
    }
    setDeleteTarget(null);
    toast.success(t("已删除部门「{name}」", { name }));
  }, [deleteTarget, deleting, refresh, selectedId, t]);

  const handleDeleteActionClick = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      // 阻止 AlertDialog 自动关闭，删除完成后再由状态驱动关闭
      event.preventDefault();
      await handleDeleteConfirm();
    },
    [handleDeleteConfirm]
  );

  const handleDialogClose = useCallback(() => {
    setCreateOpen(false);
    setEditingDepartment(null);
  }, []);

  const handleCreateOpen = useCallback(() => setCreateOpen(true), []);

  const handleDeleteDialogChange = useCallback((open: boolean) => {
    if (!open) {
      setDeleteTarget(null);
    }
  }, []);

  const handleToggleMembers = useCallback(() => {
    if (!selectedDepartment) {
      return;
    }
    const departmentId = selectedDepartment.id;
    setExpandedMembersId((current) =>
      current === departmentId ? null : departmentId
    );
  }, [selectedDepartment]);

  const handleEditOpen = useCallback(() => {
    if (selectedDepartment) {
      setEditingDepartment(selectedDepartment);
    }
  }, [selectedDepartment]);

  const renderTreeNodes = useCallback(
    (nodes: DepartmentNode[]): React.ReactNode[] =>
      nodes
        .filter((node) => !visibleIds || visibleIds.has(node.department.id))
        .map((node) => {
          const { children, department } = node;
          const childNodes = children.filter(
            (child) => !visibleIds || visibleIds.has(child.department.id)
          );
          const hasRenderableChildren =
            isSearching && visibleIds
              ? childNodes.length > 0
              : children.length > 0;
          // 搜索时命中的祖先自动展开，其余沿用手动展开状态
          const expanded = isSearching
            ? childNodes.length > 0
            : expandedIds.has(department.id);

          return (
            <Fragment key={department.id}>
              <DepartmentRow
                department={department}
                expanded={expanded}
                hasChildren={hasRenderableChildren}
                memberTotal={memberTotals.get(department.id) ?? 0}
                onSelect={handleSelect}
                onToggle={handleToggle}
                selected={department.id === selectedId}
              />
              {hasRenderableChildren && expanded ? (
                // biome-ignore lint/a11y/useSemanticElements: ARIA 树形结构需要 group 角色承载子节点
                <div
                  className="ml-[15px] flex flex-col gap-0.5 self-stretch border-l border-border pl-1"
                  role="group"
                >
                  {renderTreeNodes(children)}
                </div>
              ) : null}
            </Fragment>
          );
        }),
    [
      expandedIds,
      handleSelect,
      handleToggle,
      isSearching,
      memberTotals,
      selectedId,
      visibleIds,
    ]
  );

  const treeRows = renderTreeNodes(tree);
  const parentName = selectedDepartment?.parentId
    ? departmentById.get(selectedDepartment.parentId)?.name
    : undefined;
  const leaderName = selectedDepartment?.leaderId
    ? memberById.get(selectedDepartment.leaderId)
    : undefined;
  const departmentMembers = useMemo(
    () =>
      selectedDepartment
        ? members.filter((item) => item.departmentId === selectedDepartment.id)
        : [],
    [members, selectedDepartment]
  );
  const showAllMembers = selectedDepartment
    ? expandedMembersId === selectedDepartment.id
    : false;
  const visibleMembers = showAllMembers
    ? departmentMembers
    : departmentMembers.slice(0, MEMBER_PREVIEW_COUNT);

  return (
    <>
      <section className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-12 lg:py-16">
        <div className="mx-auto max-w-[960px]">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.025em]">
                {t("组织架构")}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {t("维护部门层级、负责人与成员信息，为权限分配提供组织依据")}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-56">
                <SearchIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/65"
                />
                <Input
                  aria-label={t("搜索部门")}
                  className="pl-9"
                  onChange={handleQueryChange}
                  placeholder={t("搜索部门")}
                  type="search"
                  value={query}
                />
              </div>
              <Button className="shrink-0" onClick={handleCreateOpen}>
                <PlusIcon data-icon="inline-start" />
                {t("新建部门")}
              </Button>
            </div>
          </header>

          <div className="mt-8 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] lg:gap-5">
            <section className="overflow-hidden rounded-[14px] border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                <h2 className="text-[15px] leading-6 font-semibold">
                  {t("企业组织树")}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {t("{count} 个部门", { count: departments.length })}
                </span>
              </div>
              <div className="max-h-[560px] overflow-y-auto p-2">
                {loadFailed ? (
                  <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                    {t("加载组织架构数据失败")}
                    <Button
                      className="mt-3"
                      onClick={handleRetry}
                      size="sm"
                      variant="outline"
                    >
                      {t("重试")}
                    </Button>
                  </div>
                ) : treeRows.length > 0 ? (
                  <div
                    aria-label={t("企业组织树")}
                    className="flex flex-col gap-0.5"
                    role="tree"
                  >
                    {treeRows}
                  </div>
                ) : (
                  <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                    {isSearching
                      ? t("没有匹配的部门")
                      : t("还没有部门，点击「新建部门」创建第一个部门")}
                  </div>
                )}
              </div>
            </section>

            {selectedDepartment ? (
              <section className="rounded-[14px] border border-border bg-card">
                <div className="p-5 sm:p-6">
                  <h2 className="text-xl leading-7 font-semibold tracking-[-0.02em]">
                    {t(selectedDepartment.name)}
                  </h2>
                  <dl className="mt-5 grid grid-cols-2 overflow-hidden rounded-[10px] border border-border/70 bg-muted/40 sm:grid-cols-4 sm:divide-x sm:divide-border/70">
                    <SummaryCell
                      label={t("部门名称")}
                      value={t(selectedDepartment.name)}
                    />
                    <SummaryCell
                      label={t("上级部门")}
                      value={parentName ? t(parentName) : "—"}
                    />
                    <SummaryCell
                      label={t("负责人")}
                      muted={leaderName === undefined}
                      value={
                        leaderName
                          ? t(getMemberDisplayName(leaderName))
                          : t("未设置")
                      }
                    />
                    <SummaryCell
                      label={t("成员数量")}
                      labelTitle={t("含下级部门的成员总数")}
                      value={t("{count} 人", {
                        count: memberTotals.get(selectedDepartment.id) ?? 0,
                      })}
                    />
                  </dl>

                  <section className="mt-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[15px] leading-6 font-semibold">
                        {t("部门成员")}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {t("直属 {count} 名成员", {
                          count: directMemberCount(selectedDepartment.id),
                        })}
                      </span>
                    </div>
                    {departmentMembers.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2.5">
                        {visibleMembers.map((member) => (
                          <MemberChip
                            isLeader={selectedDepartment.leaderId === member.id}
                            key={member.id}
                            member={member}
                          />
                        ))}
                        {departmentMembers.length > MEMBER_PREVIEW_COUNT ? (
                          <button
                            aria-label={
                              showAllMembers
                                ? t("收起成员列表")
                                : t("展开全部 {count} 名成员", {
                                    count: departmentMembers.length,
                                  })
                            }
                            className="grid size-[52px] shrink-0 place-items-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none"
                            onClick={handleToggleMembers}
                            type="button"
                          >
                            {showAllMembers ? (
                              <ChevronUpIcon
                                aria-hidden="true"
                                className="size-4"
                              />
                            ) : (
                              <MoreHorizontalIcon
                                aria-hidden="true"
                                className="size-4"
                              />
                            )}
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {t("该部门暂无直属成员")}
                      </p>
                    )}
                  </section>
                </div>
                <footer className="flex items-center justify-end border-t border-border px-5 py-4 sm:px-6">
                  <Button onClick={handleEditOpen} variant="outline">
                    <PencilIcon data-icon="inline-start" />
                    {t("编辑部门")}
                  </Button>
                </footer>
              </section>
            ) : (
              <section className="flex min-h-40 items-center justify-center rounded-[14px] border border-dashed border-border bg-card text-sm text-muted-foreground">
                {departments.length > 0
                  ? t("请在左侧选择一个部门查看详情")
                  : t("创建第一个部门后即可查看详情")}
              </section>
            )}
          </div>
        </div>
      </section>

      <DepartmentDialog
        defaultParentId={selectedId}
        department={editingDepartment}
        departments={departments}
        members={members}
        onClose={handleDialogClose}
        onDeleteRequest={handleDeleteRequest}
        onSubmit={editingDepartment ? handleUpdateSubmit : handleCreateSubmit}
        open={createOpen || editingDepartment !== null}
      />

      <AlertDialog
        onOpenChange={handleDeleteDialogChange}
        open={deleteTarget !== null}
      >
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>删除部门？</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除「{deleteTarget?.name}」
              {deleteTarget && directMemberCount(deleteTarget.id) > 0
                ? `，其 ${directMemberCount(deleteTarget.id)} 名直属成员将变为未分配部门`
                : ""}
              ，删除后无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={handleDeleteActionClick}
              variant="destructive"
            >
              {deleting ? "删除中…" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SummaryCell({
  label,
  labelTitle,
  muted = false,
  value,
}: {
  label: string;
  labelTitle?: string;
  muted?: boolean;
  value: string;
}) {
  return (
    <div className="min-w-0 px-4 py-3">
      <dt
        className="truncate text-xs leading-[18px] text-muted-foreground"
        title={labelTitle}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 truncate text-[14px] leading-5 font-semibold",
          muted ? "font-normal text-muted-foreground" : "text-foreground"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
