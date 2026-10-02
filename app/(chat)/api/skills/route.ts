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
      diagnostics: diagnostics.map(({ type, message, path }) => ({
        // 1.0.0 的 ResourceDiagnostic 以 type 取代 code；wire 格式保持不变
        code: type,
        message,
        path,
      })),
      skills,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
