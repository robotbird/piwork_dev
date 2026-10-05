import { auth } from "@/app/(auth)/auth";
import { getUserModelCatalog } from "@/lib/ai/role-access";
import { ChatbotError } from "@/lib/errors";

/** Member-scoped catalog; never cache across identities or permission changes. */
export async function GET() {
  const session = await auth();
  if (session?.user?.type !== "regular") {
    return new ChatbotError("unauthorized:chat").toResponse();
  }
  try {
    const catalog = await getUserModelCatalog(session.user.id);
    return Response.json(
      {
        allowSwitch: catalog.allowSwitch,
        capabilities: Object.fromEntries(
          catalog.models.map((model) => [model.id, model.capabilities])
        ),
        defaultModelId: catalog.defaultModelId,
        models: catalog.models,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return new ChatbotError("forbidden:chat").toResponse();
  }
}
