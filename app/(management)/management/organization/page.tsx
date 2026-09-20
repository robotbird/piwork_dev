import Link from "next/link";
import { auth } from "@/app/(auth)/auth";
import { MembersPage } from "@/components/management/members/members-page";
import { OrganizationPage } from "@/components/management/organization/organization-page";
import { Badge } from "@/components/ui/badge";
import {
  ensureMemberForUserId,
  loadMembersView,
  loadOrganizationView,
} from "@/lib/db/organization-queries";

const PERMISSIONS_VIEW = {
  description: "配置角色与权限，控制成员可访问的管理能力。",
  title: "角色与权限",
} as const;

export default async function OrganizationManagementPage({
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
    const section = PERMISSIONS_VIEW;
    return (
      <main className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-12 lg:py-16">
        <div className="mx-auto max-w-[960px]">
          <header>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-[-0.025em]">
                {section.title}
              </h1>
              <Badge variant="secondary">建设中</Badge>
            </div>
            <p className="mt-2 max-w-2xl text-[14px] leading-6 text-muted-foreground">
              {section.description}
            </p>
            <p className="mt-6 text-[14px] text-muted-foreground">
              可先前往{" "}
              <Link
                className="text-link underline-offset-4 hover:underline"
                href="/management/organization?view=members"
              >
                成员管理
              </Link>{" "}
              维护成员与角色信息。
            </p>
          </header>
        </div>
      </main>
    );
  }

  // 组织视图的负责人候选来自成员列表，同样先兜底补建当前账号
  const session = await auth();
  if (session?.user?.type === "regular") {
    await ensureMemberForUserId(session.user.id);
  }
  const organizationView = await loadOrganizationView();
  return <OrganizationPage initialData={organizationView} />;
}
