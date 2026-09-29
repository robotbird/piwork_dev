import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { ProjectsPanel } from "@/components/projects/projects-panel";

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-muted-foreground">正在加载项目...</div>
      }
    >
      <ProjectsContent />
    </Suspense>
  );
}

async function ProjectsContent() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return <ProjectsPanel />;
}
