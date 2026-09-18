import { Suspense } from "react";
import { AdminSkillManager } from "@/components/management/admin-skill-manager";
import { loadProjectSkillSummaries } from "@/lib/ai/skills";

export default function SkillsManagementPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <SkillsManagementContent />
    </Suspense>
  );
}

async function SkillsManagementContent() {
  const { skills } = await loadProjectSkillSummaries();

  return <AdminSkillManager initialSkills={skills} />;
}
