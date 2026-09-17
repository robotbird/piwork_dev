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
            "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
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
    <div className="flex min-h-dvh w-full flex-col bg-[#f9fbfe] text-foreground md:flex-row">
      <ManagementSidebar
        user={{ email: session.user.email, name: session.user.name }}
      />
      <div className="min-w-0 flex-1">
        <div className="hidden h-14 border-b border-[#e3e9f2] bg-white md:block" />
        {children}
      </div>
    </div>
  );
}
