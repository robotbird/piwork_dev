import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { joinProjectShare } from "@/lib/db/project-share-queries";
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = z
    .object({ projectId: z.uuid(), token: z.string().min(1).max(128) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (
    !(await joinProjectShare(
      parsed.data.projectId,
      session.user.id,
      parsed.data.token
    ))
  ) {
    return Response.json(
      { error: "分享链接失效或账号未启用" },
      { status: 403 }
    );
  }
  return Response.json({ projectId: parsed.data.projectId });
}
