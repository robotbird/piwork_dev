import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { ScheduledTasksPanel } from "@/components/scheduled-tasks/scheduled-tasks-panel";

export default async function ScheduledTasksPage() {
  const t = await getTranslations("scheduledTasks");
  return (
    <Suspense
      fallback={
        <div className="p-12 text-muted-foreground">{t("loadingPage")}</div>
      }
    >
      <ScheduledTasksContent />
    </Suspense>
  );
}

async function ScheduledTasksContent() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return <ScheduledTasksPanel />;
}
