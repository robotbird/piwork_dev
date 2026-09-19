import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { ManagementSidebar } from "@/components/management/management-sidebar";

export default function ManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={<div className="min-h-dvh bg-background" />}>
        <AuthenticatedManagement>{children}</AuthenticatedManagement>
      </Suspense>
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className:
            "!bg-card !text-foreground !border-[var(--hairline-strong)] !shadow-none",
        }}
      />
    </>
  );
}

async function AuthenticatedManagement({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (session?.user?.type !== "regular") {
    redirect("/login");
  }

  return (
    <div className="openai-management flex min-h-dvh w-full flex-col bg-background text-foreground md:flex-row">
      <ManagementSidebar
        user={{ email: session.user.email, name: session.user.name }}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
