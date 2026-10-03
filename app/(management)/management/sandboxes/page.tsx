import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SandboxesPage } from "@/components/management/sandboxes/sandboxes-page";
import { Button } from "@/components/ui/button";
import { requireManagementAdmin } from "@/lib/management/access";
import { getSandboxManagement } from "@/lib/management/sandboxes";

/** 非管理员可见的占位说明（沙箱运行状态仅管理员可访问） */
async function PermissionNotice() {
  const t = await getTranslations("management");
  return (
    <section className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-12 lg:py-16">
      <div className="mx-auto max-w-[960px]">
        <h1 className="text-2xl font-semibold tracking-[-0.025em]">
          {t("sandboxManagementTitle")}
        </h1>
        <div className="mt-8 rounded-[14px] border border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {t("sandboxPermissionRequired")}
          </p>
          <Button asChild className="mt-5" variant="outline">
            <Link href="/management">{t("backToWorkspace")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/** 沙箱管理：查看用户运行中的沙箱实例状态（SandboxInstance 注册表） */
export default async function SandboxesManagementPage() {
  const session = await requireManagementAdmin();
  if (!session) {
    return <PermissionNotice />;
  }

  const instances = await getSandboxManagement().list();
  return (
    <SandboxesPage
      initialInstances={instances.map((instance) => ({
        ...instance,
        chatId: instance.chatId,
        chatTitle: instance.chatTitle,
        createdAt: instance.createdAt.toISOString(),
        expiresAt: instance.expiresAt.toISOString(),
        externalId: instance.externalId,
        id: instance.id,
        image: instance.image,
        lastRenewedAt: instance.lastRenewedAt.toISOString(),
        lastRunId: instance.lastRunId,
        provider: instance.provider,
        status: instance.status,
        ttlSeconds: instance.ttlSeconds,
        userEmail: instance.userEmail,
        userId: instance.userId,
        userName: instance.userName,
      }))}
    />
  );
}
