import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { MAX_CHAT_ATTACHMENT_SIZE } from "@/lib/ai/attachment-types";
import { DocumentInputError } from "@/lib/ai/document-errors";
import {
  createSource,
  getProject,
  getProjectDocumentSources,
  listSources,
} from "@/lib/db/project-queries";
import { assembleProjectSourcesContext } from "@/lib/projects/context";
import {
  extractSourceText,
  MAX_PROJECT_IMAGE_BYTES,
  sourceImageMime,
  sourceTypeFromFilename,
} from "@/lib/projects/source-files";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { projectId } = await context.params;
  if (!z.uuid().safeParse(projectId).success) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const sources = await listSources(session.user.id, projectId);
  if (sources === null) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({ sources });
}

export async function POST(request: Request, context: Context) {
  const t = await getTranslations("api");
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: t("unauthorized") }, { status: 401 });
  }
  const { projectId } = await context.params;
  if (!z.uuid().safeParse(projectId).success) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const project = await getProject(session.user.id, projectId);
  if (!project || project.userId !== session.user.id) {
    return Response.json({ error: t("projectNotFound") }, { status: 404 });
  }

  let file: File;
  try {
    const formData = await request.formData();
    const candidate = formData.get("file");
    if (!(candidate instanceof File)) {
      return Response.json({ error: t("fileRequired") }, { status: 400 });
    }
    file = candidate;
  } catch {
    return Response.json({ error: t("requestBodyEmpty") }, { status: 400 });
  }

  if (file.size > MAX_CHAT_ATTACHMENT_SIZE) {
    return Response.json({ error: t("fileTooLarge") }, { status: 400 });
  }
  const type = sourceTypeFromFilename(file.name);
  if (!type) {
    return Response.json({ error: t("sourceUnsupported") }, { status: 400 });
  }

  if (sourceImageMime(type) && file.size > MAX_PROJECT_IMAGE_BYTES) {
    return Response.json({ error: t("sourceImageLimit") }, { status: 400 });
  }

  // Store bounded complete extraction; chat previews are a separate projection.
  const content = new Uint8Array(await file.arrayBuffer());
  let text: string;
  try {
    text = await extractSourceText({ content, signal: request.signal, type });
  } catch (error) {
    console.error("[project-sources] extract text failed:", error);
    return Response.json(
      {
        error:
          error instanceof DocumentInputError
            ? error.message
            : t("sourceExtractFailed"),
      },
      { status: 400 }
    );
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return Response.json({ error: t("sourceNoText") }, { status: 400 });
  }

  // Preflight the complete catalog; chat/startup repeat checks for racing uploads.
  const existing = await getProjectDocumentSources(session.user.id, projectId);
  try {
    assembleProjectSourcesContext(
      [
        ...existing,
        { content: text, id: crypto.randomUUID(), name: file.name, type },
      ],
      undefined,
      true
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof DocumentInputError
            ? error.message
            : t("sourceExtractFailed"),
      },
      { status: 400 }
    );
  }

  const source = await createSource(session.user.id, projectId, {
    content: text,
    name: file.name,
    type,
  });
  if (!source) {
    return Response.json({ error: t("projectNotFound") }, { status: 404 });
  }

  return Response.json(
    {
      source: {
        createdAt: source.createdAt,
        id: source.id,
        name: source.name,
        type: source.type,
      },
    },
    { status: 201 }
  );
}
