import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={<div className="min-h-dvh bg-background" />}>
        <AuthenticatedAdmin>{children}</AuthenticatedAdmin>
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

async function AuthenticatedAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (session?.user?.type !== "regular") {
    redirect("/login");
  }

  return (
    <div className="openai-admin flex min-h-dvh w-full flex-col bg-background text-foreground md:flex-row">
      <AdminSidebar
        user={{ email: session.user.email, name: session.user.name }}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
