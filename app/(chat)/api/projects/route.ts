import { getTranslations } from "next-intl/server";
import { auth } from "@/app/(auth)/auth";
import { createProject, listProjects } from "@/lib/db/project-queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const projects = await listProjects(session.user.id);
  return Response.json({ projects });
}

export async function POST(request: Request) {
  const t = await getTranslations("api");
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: t("unauthorized") }, { status: 401 });
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

  const project = await createProject(session.user.id, name);
  return Response.json({ project }, { status: 201 });
}
