import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { deleteSource } from "@/lib/db/project-queries";

type Context = { params: Promise<{ projectId: string; sourceId: string }> };

export async function DELETE(_request: Request, context: Context) {
  const t = await getTranslations("api");
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: t("unauthorized") }, { status: 401 });
  }
  const { projectId, sourceId } = await context.params;
  if (
    !z.uuid().safeParse(projectId).success ||
    !z.uuid().safeParse(sourceId).success
  ) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const deleted = await deleteSource(session.user.id, projectId, sourceId);
  if (!deleted) {
    return Response.json({ error: t("sourceNotFound") }, { status: 404 });
  }
  return Response.json({ source: deleted });
}
