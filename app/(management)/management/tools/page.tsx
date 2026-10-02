import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { McpServersPage } from "@/components/management/tools/mcp-servers-page";
import { PiPackagesPage } from "@/components/management/tools/pi-packages-page";
import { Button } from "@/components/ui/button";
import { listMcpServers } from "@/lib/db/mcp-server-queries";
import { listPiPackages } from "@/lib/db/pi-package-queries";
import { requireManagementAdmin } from "@/lib/management/access";

/** 非管理员可见的占位说明(MCP 服务与插件配置仅管理员可访问) */
async function PermissionNotice() {
  const t = await getTranslations("management");
  return (
    <section className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-12 lg:py-16">
      <div className="mx-auto max-w-[960px]">
        <h1 className="text-2xl font-semibold tracking-[-0.025em]">
          {t("toolsManagementTitle")}
        </h1>
        <div className="mt-8 rounded-[14px] border border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {t("toolsPermissionRequired")}
          </p>
          <Button asChild className="mt-5" variant="outline">
            <Link href="/management">{t("backToWorkspace")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

type ToolsView = "mcp" | "pi-plugins";

function parseView(value: string | undefined): ToolsView {
  return value === "pi-plugins" ? "pi-plugins" : "mcp";
}

async function McpView() {
  const records = await listMcpServers();
  const servers = records.map((record) => ({
    args: record.args,
    command: record.command,
    description: record.description,
    enabled: record.enabled,
    env: record.env,
    headers: record.headers,
    id: record.id,
    name: record.name,
    transport: record.transport,
    url: record.url,
  }));
  return <McpServersPage initialServers={servers} />;
}

async function PiPackagesView() {
  const records = await listPiPackages();
  const packages = records.map((record) => ({
    id: record.id,
    installedSkills: record.installedSkills,
    name: record.name,
    resourceSummary: record.resourceSummary,
    source: record.source,
    system: record.system,
    version: record.version,
  }));
  return <PiPackagesPage initialPackages={packages} />;
}

/** 工具管理:MCP 服务(默认)/ pi 官方插件,`?view=` 切换(organization 先例) */
export default async function ToolsManagementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireManagementAdmin();
  if (!session) {
    return <PermissionNotice />;
  }

  const params = await searchParams;
  const rawView = Array.isArray(params.view) ? params.view[0] : params.view;
  return parseView(rawView) === "pi-plugins" ? <PiPackagesView /> : <McpView />;
}
