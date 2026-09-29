import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createProjectChat,
  getProject,
  listProjectChats,
  touchProject,
} from "@/lib/db/project-queries";

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
  const chats = await listProjectChats(session.user.id, projectId);
  return Response.json({ chats });
}

export async function POST(request: Request, context: Context) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { projectId } = await context.params;
  if (!z.uuid().safeParse(projectId).success) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const project = await getProject(session.user.id, projectId);
  if (!project) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  let body: { id?: unknown; title?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const id = z.uuid().safeParse(body.id).success
    ? (body.id as string)
    : undefined;
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 256)
      : "New chat";

  const chat = await createProjectChat({
    id,
    projectId,
    title,
    userId: session.user.id,
  });
  await touchProject(projectId);
  return Response.json({ chat }, { status: 201 });
}
