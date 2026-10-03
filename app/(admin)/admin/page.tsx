import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DashboardOverview } from "@/components/admin/dashboard-overview";
import { Button } from "@/components/ui/button";
import { requireAdminRole } from "@/lib/admin/access";
import { getAdminOverview } from "@/lib/admin/overview";

/** 非管理员可见的占位说明（概览为全组织统计，与 /api/admin/overview 鉴权一致） */
async function PermissionNotice() {
  const tAdmin = await getTranslations("admin");
  const tDashboard = await getTranslations("dashboard");
  return (
    <section className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-12 lg:py-16">
      <div className="mx-auto max-w-[960px]">
        <h1 className="text-2xl font-semibold tracking-[-0.025em]">
          {tDashboard("overview")}
        </h1>
        <div className="mt-8 rounded-[14px] border border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {tAdmin("overviewPermissionRequired")}
          </p>
          <Button asChild className="mt-5" variant="outline">
            <Link href="/">{tAdmin("backToWorkspace")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/** 管理概览：服务端预取聚合数据，客户端可手动刷新（GET /api/admin/overview） */
export default async function AdminOverviewPage() {
  const session = await requireAdminRole();
  if (!session) {
    return <PermissionNotice />;
  }

  // 失败时不阻塞整页渲染：客户端组件会回退到 API 拉取并可重试
  const initialOverview = await getAdminOverview().catch(() => null);
  return <DashboardOverview initialOverview={initialOverview} />;
}
