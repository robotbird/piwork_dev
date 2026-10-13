import { requireAdminRole } from "@/lib/admin/access";
import {
  getUploadSettings,
  saveUploadSettings,
} from "@/lib/db/upload-settings-queries";
import { ChatbotError } from "@/lib/errors";
import { uploadSettingsSchema } from "@/lib/uploads/settings";

const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  if (!(await requireAdminRole())) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }
  try {
    return Response.json(await getUploadSettings(), { headers });
  } catch {
    return Response.json(
      { error: "upload-settings:unavailable" },
      { headers, status: 503 }
    );
  }
}
export async function PATCH(request: Request) {
  const session = await requireAdminRole();
  if (!session) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }
  const parsed = uploadSettingsSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return Response.json(
      { error: "upload-settings:invalid-input" },
      { headers, status: 400 }
    );
  }
  try {
    return Response.json(
      await saveUploadSettings(parsed.data, session.userId),
      { headers }
    );
  } catch {
    return Response.json(
      { error: "upload-settings:unavailable" },
      { headers, status: 503 }
    );
  }
}
