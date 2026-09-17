import { Suspense } from "react";
import { SkillManager } from "@/components/management/skill-manager";
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

  return <SkillManager initialSkills={skills} />;
}
