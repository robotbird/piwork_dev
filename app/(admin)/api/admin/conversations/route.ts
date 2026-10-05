import { requireAdminRole } from "@/lib/admin/access";
import { conversationFilters } from "@/lib/admin/conversations";
import { listAdminConversations } from "@/lib/db/conversation-queries";
import { ChatbotError } from "@/lib/errors";

export async function GET(request: Request) {
  if (!(await requireAdminRole())) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }
  const parsed = conversationFilters.safeParse(
    Object.fromEntries(new URL(request.url).searchParams)
  );
  if (!parsed.success) {
    return new ChatbotError("bad_request:api").toResponse();
  }
  try {
    return Response.json(await listAdminConversations(parsed.data), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[admin conversations] list failed", error);
    return new ChatbotError("bad_request:database").toResponse();
  }
}
