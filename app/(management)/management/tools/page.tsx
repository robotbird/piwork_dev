import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { McpServersPage } from "@/components/management/tools/mcp-servers-page";
import { Button } from "@/components/ui/button";
import { listMcpServers } from "@/lib/db/mcp-server-queries";
import { requireManagementAdmin } from "@/lib/management/access";

/** 非管理员可见的占位说明（MCP 服务与插件配置仅管理员可访问） */
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

// Task 2 起 ?view=pi-plugins 切换 pi 插件模块；当前默认且唯一的视图是 MCP 服务
export default async function ToolsManagementPage() {
  const session = await requireManagementAdmin();
  if (!session) {
    return <PermissionNotice />;
  }

  // 默认视图：MCP 服务管理（?view=mcp 可省略）
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
