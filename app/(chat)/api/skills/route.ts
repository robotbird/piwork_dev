import { auth } from "@/app/(auth)/auth";
import { loadProjectSkillSummaries } from "@/lib/ai/skills";
import { ChatbotError } from "@/lib/errors";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { skills, diagnostics } = await loadProjectSkillSummaries();

  return Response.json(
    {
      diagnostics: diagnostics.map(({ code, message, path }) => ({
        code,
        message,
        path,
      })),
      skills: skills.sort((left, right) => left.name.localeCompare(right.name)),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
