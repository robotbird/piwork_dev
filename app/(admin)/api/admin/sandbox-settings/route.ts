import { requireAdminRole } from "@/lib/admin/access";
import { getSandboxSettingsView } from "@/lib/admin/sandbox-settings";
import { saveSandboxResourcePolicy } from "@/lib/db/sandbox-settings-queries";
import { ChatbotError } from "@/lib/errors";
import { sandboxResourceSchema } from "@/lib/runtime/sandbox/resource-policy";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  if (!(await requireAdminRole())) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }
  try {
    return Response.json(await getSandboxSettingsView(), { headers });
  } catch {
    return Response.json(
      { error: "sandbox-settings:unavailable" },
      { headers, status: 503 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await requireAdminRole();
  if (!session) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "sandbox-settings:invalid-input" },
      { headers, status: 400 }
    );
  }
  const parsed = sandboxResourceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "sandbox-settings:invalid-input" },
      { headers, status: 400 }
    );
  }
  try {
    const resource = await saveSandboxResourcePolicy(
      parsed.data,
      session.userId
    );
    return Response.json({ resource }, { headers });
  } catch {
    return Response.json(
      { error: "sandbox-settings:unavailable" },
      { headers, status: 503 }
    );
  }
}
