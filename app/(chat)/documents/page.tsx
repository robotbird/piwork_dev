import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { DocumentLibrary } from "@/components/documents/document-library";

export default async function DocumentsPage() {
  const t = await getTranslations("documents");
  return (
    <Suspense
      fallback={
        <div className="p-12 text-muted-foreground">{t("loadingPage")}</div>
      }
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
