import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ModelsPage } from "@/components/management/models/models-page";
import { Button } from "@/components/ui/button";
import { requireManagementAdmin } from "@/lib/management/access";
import { loadModelPluginsView } from "@/lib/model-plugins/view";

/** 非管理员可见的占位说明（模型凭证仅管理员可访问） */
async function PermissionNotice() {
  const t = await getTranslations("management");
  return (
    <section className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-12 lg:py-16">
      <div className="mx-auto max-w-[960px]">
        <h1 className="text-2xl font-semibold tracking-[-0.025em]">
          {t("modelManagement")}
        </h1>
        <div className="mt-8 rounded-[14px] border border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {t("permissionRequired")}
          </p>
          <Button asChild className="mt-5" variant="outline">
            <Link href="/management">{t("backToWorkspace")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export default async function ModelsManagementPage() {
  const session = await requireManagementAdmin();
  if (!session) {
    return <PermissionNotice />;
  }

  const view = await loadModelPluginsView();
  return <ModelsPage initialData={view} />;
}
