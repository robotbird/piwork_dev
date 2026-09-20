import { Suspense } from "react";
import { SkillMarketplace } from "@/components/chat/skill-marketplace";
import { loadManagedProjectSkillSummaries } from "@/lib/ai/managed-skills";
import { publicSkillCatalog } from "@/lib/ai/skill-catalog";

export default function SkillsPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <SkillsContent />
    </Suspense>
  );
}

async function SkillsContent() {
  const { skills } = await loadManagedProjectSkillSummaries({
    enabledOnly: true,
  });

  return (
    <main className="min-h-dvh border-l border-border bg-background">
      <SkillMarketplace
        catalog={publicSkillCatalog}
        initialSkills={skills}
        readOnly
      />
    </main>
  );
}
