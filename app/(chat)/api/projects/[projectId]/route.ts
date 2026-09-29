import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  deleteProject,
  getProject,
  listProjectChats,
  renameProject,
} from "@/lib/db/project-queries";
import { getRunManager } from "@/lib/runtime/run";

type Context = { params: Promise<{ projectId: string }> };

async function requireOwnedProject(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: Response.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!z.uuid().safeParse(projectId).success) {
    return { error: Response.json({ error: "bad_request" }, { status: 400 }) };
  }
  const project = await getProject(session.user.id, projectId);
  if (!project) {
    return { error: Response.json({ error: "not_found" }, { status: 404 }) };
  }
  return { project, session };
}

export async function GET(_request: Request, context: Context) {
  const { projectId } = await context.params;
  const result = await requireOwnedProject(projectId);
  if (result.error) {
    return result.error;
  }
  return Response.json({ project: result.project });
}

export async function PATCH(request: Request, context: Context) {
  const t = await getTranslations("api");
  const { projectId } = await context.params;
  const result = await requireOwnedProject(projectId);
  if (result.error) {
    return result.error;
  }

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: t("requestBodyEmpty") }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 128) {
    return Response.json({ error: t("projectNameInvalid") }, { status: 400 });
  }

  const project = await renameProject(result.session.user.id, projectId, name);
  return Response.json({ project });
}

export async function DELETE(_request: Request, context: Context) {
  const { projectId } = await context.params;
  const result = await requireOwnedProject(projectId);
  if (result.error) {
    return result.error;
  }

  // 项目聊天是普通 Chat 行：先停活跃 run，避免删除后 run 继续落消息
  const chats = await listProjectChats(result.session.user.id, projectId);
  await Promise.all(
    chats.map((chat) =>
      getRunManager()
        .abortByChat(chat.chatId)
        .catch(() => undefined)
    )
  );

  const deleted = await deleteProject(result.session.user.id, projectId);
  if (!deleted) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({ project: deleted });
}
