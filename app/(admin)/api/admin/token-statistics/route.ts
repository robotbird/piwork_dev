import { requireAdminRole } from "@/lib/admin/access";
import { tokenFilters } from "@/lib/admin/token-statistics";
import { getTokenStatistics } from "@/lib/db/token-statistics-queries";
import { ChatbotError } from "@/lib/errors";

export async function GET(request: Request) {
  if (!(await requireAdminRole())) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }
  const parsed = tokenFilters.safeParse(
    Object.fromEntries(new URL(request.url).searchParams)
  );
  if (!parsed.success) {
    return new ChatbotError("bad_request:api").toResponse();
  }
  try {
    return Response.json(await getTokenStatistics(parsed.data), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[admin token statistics] query failed", error);
    return Response.json({ error: "Statistics unavailable" }, { status: 500 });
  }
}
