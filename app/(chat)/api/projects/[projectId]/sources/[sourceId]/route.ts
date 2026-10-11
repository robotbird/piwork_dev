import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { deleteSource, getProjectSource } from "@/lib/db/project-queries";

import {
  decodeSourceImage,
  sourceImageMime,
} from "@/lib/projects/source-files";

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

export async function GET(_request: Request, context: Context) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { projectId, sourceId } = await context.params;
  if (
    !z.uuid().safeParse(projectId).success ||
    !z.uuid().safeParse(sourceId).success
  ) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const source = await getProjectSource(session.user.id, projectId, sourceId);
  if (!source || !sourceImageMime(source.type)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  try {
    const image = decodeSourceImage(source.content, source.type);
    return new Response(Buffer.from(image.data, "base64"), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": image.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "invalid_image" }, { status: 422 });
  }
}
