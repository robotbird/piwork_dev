import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { ProjectsPanel } from "@/components/projects/projects-panel";

export default async function ProjectsPage() {
  const t = await getTranslations("projects");
  return (
    <Suspense
      fallback={
        <div className="p-12 text-muted-foreground">{t("loadingPage")}</div>
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
