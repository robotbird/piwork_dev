import { Suspense } from "react";
import { AdminSkillManager } from "@/components/admin/admin-skill-manager";
import { loadManagedProjectSkillSummaries } from "@/lib/ai/managed-skills";

export default function SkillsAdminPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <SkillsAdminContent />
    </Suspense>
  );
}

async function SkillsAdminContent() {
  const { skills } = await loadManagedProjectSkillSummaries();

  return <AdminSkillManager initialSkills={skills} />;
}
