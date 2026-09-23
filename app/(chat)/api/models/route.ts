import { getActiveModelCatalog } from "@/lib/ai/active-models";

/**
 * 聊天模型目录：下发模型管理平台配置的启用模型与默认模型（不含访问凭证）。
 * 平台未配置任何模型时返回空列表，前端据此显示「未配置模型」。
 */
export async function GET() {
  const catalog = await getActiveModelCatalog();
  const capabilities = Object.fromEntries(
    catalog.models.map((model) => [model.id, model.capabilities])
  );

  return Response.json(
    {
      capabilities,
      defaultModelId: catalog.defaultModelId,
      models: catalog.models,
    },
    { headers: { "Cache-Control": "private, max-age=60" } }
  );
}
