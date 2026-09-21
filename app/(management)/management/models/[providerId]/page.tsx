import { notFound, redirect } from "next/navigation";
import { ProviderDetailPage } from "@/components/management/models/provider-detail-page";
import { loadProviderDetailView } from "@/lib/db/model-queries";
import { requireManagementAdmin } from "@/lib/management/access";

export default async function ProviderDetailRoutePage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  // 详情页包含访问凭证，仅管理员可访问
  const session = await requireManagementAdmin();
  if (!session) {
    redirect("/management/models");
  }

  const { providerId } = await params;
  const view = await loadProviderDetailView(providerId);
  if (!view) {
    notFound();
  }
  return <ProviderDetailPage initialData={view} />;
}
