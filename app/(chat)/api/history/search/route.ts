import { auth } from "@/app/(auth)/auth";
import { searchAccessibleChats } from "@/lib/db/chat-search-queries";
import { getMemberByUserId } from "@/lib/db/organization-queries";
import { ChatbotError } from "@/lib/errors";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }
  const member = await getMemberByUserId(session.user.id);
  if (member?.status !== "enabled") {
    return new ChatbotError("forbidden:chat").toResponse();
  }
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length > 200) {
    return new ChatbotError("bad_request:api").toResponse();
  }
  try {
    return Response.json(await searchAccessibleChats(session.user.id, query), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return new ChatbotError("bad_request:database").toResponse();
  }
}
