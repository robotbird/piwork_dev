import { auth } from "@/app/(auth)/auth";
import { durableChatAvailable } from "@/lib/runtime/run/durable-chat";

export async function GET() {
  const session = await auth();
  if (session?.user?.type !== "regular") {
    return new Response(null, { status: 401 });
  }
  try {
    return Response.json(
      { durableSandbox: await durableChatAvailable(session.user.id) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return Response.json(
      { durableSandbox: false },
      { headers: { "Cache-Control": "private, no-store" }, status: 503 }
    );
  }
}
