import { auth } from "@/app/(auth)/auth";
import { MembersPage } from "@/components/admin/members/members-page";
import { OrganizationPage } from "@/components/admin/organization/organization-page";
import { RolesPage } from "@/components/admin/roles/roles-page";
import {
  ensureMemberForUserId,
  loadMembersView,
  loadOrganizationView,
} from "@/lib/db/organization-queries";
import { loadRolesView } from "@/lib/db/role-queries";

export default async function OrganizationAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const params = await searchParams;
  const view = Array.isArray(params.view) ? params.view[0] : params.view;

  if (view === "members") {
    const session = await auth();
    // 老会话不经过登录流程，加载数据前先兜底补建成员记录，否则当前账号不会出现在列表中
    if (session?.user?.type === "regular") {
      await ensureMemberForUserId(session.user.id);
    }
    const membersView = await loadMembersView();
    return (
      <MembersPage
        currentUserId={session?.user?.id ?? null}
        initialData={membersView}
      />
    );
  }

  if (view === "permissions") {
    const session = await auth();
    if (session?.user?.type === "regular") {
      await ensureMemberForUserId(session.user.id);
    }
    // loadRolesView 内部会写入系统角色种子并回填成员关系
    const rolesView = await loadRolesView();
    return <RolesPage initialData={rolesView} />;
  }

  // 组织视图的负责人候选来自成员列表，同样先兜底补建当前账号
  const session = await auth();
  if (session?.user?.type === "regular") {
    await ensureMemberForUserId(session.user.id);
  }
  const organizationView = await loadOrganizationView();
  return <OrganizationPage initialData={organizationView} />;
}
