import { z } from "zod";
import { requireAdminRole } from "@/lib/admin/access";
import { getAdminConversation } from "@/lib/db/conversation-queries";
import { ChatbotError } from "@/lib/errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdminRole())) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }
  const { id } = await params;
  const search = new URL(request.url).searchParams;
  const parsed = z
    .object({
      id: z.uuid(),
      page: z.coerce.number().int().min(1).max(100_000),
      preview: z.enum(["0", "1"]),
    })
    .safeParse({
      id,
      page: search.get("page") ?? 1,
      preview: search.get("preview") ?? "0",
    });
  if (!parsed.success) {
    return new ChatbotError("bad_request:api").toResponse();
  }
  try {
    const detail = await getAdminConversation(
      id,
      parsed.data.page,
      parsed.data.preview === "1"
    );
    if (!detail) {
      return new ChatbotError("not_found:chat").toResponse();
    }
    return Response.json(detail, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[admin conversations] detail failed", error);
    return new ChatbotError("bad_request:database").toResponse();
  }
}
