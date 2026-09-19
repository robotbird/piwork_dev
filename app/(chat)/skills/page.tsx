import { Suspense } from "react";
import { SkillMarketplace } from "@/components/chat/skill-marketplace";
import { publicSkillCatalog } from "@/lib/ai/skill-catalog";
import { loadProjectSkillSummaries } from "@/lib/ai/skills";

export default function SkillsPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <SkillsContent />
    </Suspense>
  );
}

async function SkillsContent() {
  const { skills } = await loadProjectSkillSummaries();

  return (
    <main className="min-h-dvh border-l border-border bg-background">
      <SkillMarketplace catalog={publicSkillCatalog} initialSkills={skills} />
    </main>
  );
}
