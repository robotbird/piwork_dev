import { notFound, redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { ProjectHome } from "@/components/projects/project-home";
import { getProject } from "@/lib/db/project-queries";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const project = await getProject(session.user.id, projectId);
  if (!project) {
    notFound();
  }
  return <ProjectHome projectId={project.id} projectName={project.name} />;
}
