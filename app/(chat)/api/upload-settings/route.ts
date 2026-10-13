import { auth } from "@/app/(auth)/auth";
import { getMemberByUserId } from "@/lib/db/organization-queries";
import { getUploadSettings } from "@/lib/db/upload-settings-queries";
import { ChatbotError } from "@/lib/errors";

const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  const session = await auth();
  if (session?.user?.type !== "regular") {
    return new ChatbotError("unauthorized:chat").toResponse();
  }
  try {
    const member = await getMemberByUserId(session.user.id);
    if (member?.status !== "enabled") {
      return new ChatbotError("forbidden:chat").toResponse();
    }
    return Response.json(await getUploadSettings(), { headers });
  } catch {
    return Response.json(
      { error: "upload-settings:unavailable" },
      { headers, status: 503 }
    );
  }
}
