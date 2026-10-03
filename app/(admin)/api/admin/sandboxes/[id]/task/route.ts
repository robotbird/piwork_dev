import { z } from "zod";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";
import { getSandboxInstanceById } from "@/lib/db/sandbox-queries";
import { ChatbotError } from "@/lib/errors";
import { requireAdminRole } from "@/lib/admin/access";
import { convertToUIMessages } from "@/lib/utils";

/** Registered sandbox tasks are administrator-readable; normal chat APIs retain ownership checks. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdminRole())) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return new ChatbotError("bad_request:api").toResponse();
  }
  const sandbox = await getSandboxInstanceById(id);
  if (!sandbox) {
    return new ChatbotError("not_found:chat").toResponse();
  }
  if (new URL(request.url).searchParams.get("chatId") !== sandbox.chatId) {
    return new ChatbotError("forbidden:chat").toResponse();
  }
  const chat = await getChatById({ id: sandbox.chatId });
  if (!chat) {
    return new ChatbotError("not_found:chat").toResponse();
  }
  const messages = await getMessagesByChatId({ id: sandbox.chatId });
  return Response.json(
    {
      isReadonly: true,
      messages: convertToUIMessages(messages),
      userId: chat.userId,
      visibility: chat.visibility,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
