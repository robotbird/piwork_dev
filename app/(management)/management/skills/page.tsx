import { Suspense } from "react";
import { AdminSkillManager } from "@/components/management/admin-skill-manager";
import { loadManagedProjectSkillSummaries } from "@/lib/ai/managed-skills";

export default function SkillsManagementPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <SkillsManagementContent />
    </Suspense>
  );
}

async function SkillsManagementContent() {
  const { skills } = await loadManagedProjectSkillSummaries();

  return <AdminSkillManager initialSkills={skills} />;
}
