import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { DocumentLibrary } from "@/components/documents/document-library";

export default function DocumentsPage() {
  return (
    <Suspense
      fallback={<div className="p-12 text-muted-foreground">正在加载文档…</div>}
    >
      <DocumentsContent />
    </Suspense>
  );
}
async function DocumentsContent() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return <DocumentLibrary />;
}
