import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { ScheduledTasksPanel } from "@/components/scheduled-tasks/scheduled-tasks-panel";

export default function ScheduledTasksPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-muted-foreground">正在加载定时任务...</div>
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
