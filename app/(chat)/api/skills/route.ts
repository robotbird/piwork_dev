import { auth } from "@/app/(auth)/auth";
import { loadManagedProjectSkillSummaries } from "@/lib/ai/managed-skills";
import { ChatbotError } from "@/lib/errors";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { skills, diagnostics } = await loadManagedProjectSkillSummaries({
    enabledOnly: true,
  });

  return Response.json(
    {
      diagnostics: diagnostics.map(({ code, message, path }) => ({
        code,
        message,
        path,
      })),
      skills,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
