import { auth } from "@/app/(auth)/auth";
import { getInstallableCatalogSkill } from "@/lib/ai/skill-catalog";
import {
  createProjectSkill,
  deleteProjectSkill,
  extractProjectSkillArchive,
  installProjectSkill,
  loadProjectSkillSummaries,
  MAX_SKILL_UPLOAD_FILE_COUNT,
  MAX_SKILL_UPLOAD_FILE_SIZE,
  MAX_SKILL_UPLOAD_TOTAL_SIZE,
  setProjectSkillEnabled,
} from "@/lib/ai/skills";
import { ChatbotError } from "@/lib/errors";

function apiError(error: unknown, status = 400) {
  return Response.json(
    { error: error instanceof Error ? error.message : "Unknown error" },
    { status }
  );
}

async function requireRegularUser() {
  const session = await auth();
  return session?.user?.type === "regular" ? session : null;
}

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

export async function POST(request: Request) {
  const session = await requireRegularUser();
  if (!session) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = (await request.json()) as { catalogSkillName?: unknown };
      if (typeof body.catalogSkillName !== "string") {
        return apiError("A catalog skill name is required.");
      }

      const catalogSkill = getInstallableCatalogSkill(body.catalogSkillName);
      if (!catalogSkill) {
        return apiError("The requested catalog skill was not found.", 404);
      }

      const skill = await createProjectSkill({
        description: catalogSkill.description,
        displayName: catalogSkill.displayName,
        instructions: catalogSkill.instructions,
        name: catalogSkill.name,
      });

      return Response.json({ name: skill.name }, { status: 201 });
    }

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((item) => item instanceof File);
    const paths = formData.getAll("paths").map(String);

    if (files.length === 0) {
      return apiError("Choose a skill folder or ZIP archive to upload.");
    }
    if (files.length > MAX_SKILL_UPLOAD_FILE_COUNT) {
      return apiError(
        `A skill can contain at most ${MAX_SKILL_UPLOAD_FILE_COUNT} files.`
      );
    }

    const isZipUpload =
      files.length === 1 && files[0].name.toLocaleLowerCase().endsWith(".zip");
    if (
      !isZipUpload &&
      files.some((file) => file.name.toLocaleLowerCase().endsWith(".zip"))
    ) {
      return apiError("Upload one ZIP archive at a time.");
    }
    if (!isZipUpload && files.length !== paths.length) {
      return apiError("The uploaded skill folder has invalid file paths.");
    }

    let totalSize = 0;
    for (const file of files) {
      if (!isZipUpload && file.size > MAX_SKILL_UPLOAD_FILE_SIZE) {
        return apiError(`File "${file.name}" exceeds the 5 MB limit.`);
      }
      totalSize += file.size;
    }
    if (totalSize > MAX_SKILL_UPLOAD_TOTAL_SIZE) {
      return apiError(
        isZipUpload
          ? "The ZIP file exceeds the 15 MB upload limit."
          : "The skill folder exceeds the 15 MB total limit."
      );
    }

    const uploadedFiles = isZipUpload
      ? extractProjectSkillArchive({
          content: new Uint8Array(await files[0].arrayBuffer()),
          filename: files[0].name,
        })
      : await Promise.all(
          files.map(async (file, index) => ({
            content: new Uint8Array(await file.arrayBuffer()),
            path: paths[index],
          }))
        );

    const skill = await installProjectSkill({
      files: uploadedFiles,
    });

    return Response.json({ name: skill.name }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return apiError(error, message.includes("already exists") ? 409 : 400);
  }
}

export async function PATCH(request: Request) {
  const session = await requireRegularUser();
  if (!session) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  try {
    const body = (await request.json()) as {
      enabled?: unknown;
      name?: unknown;
    };
    if (typeof body.name !== "string" || typeof body.enabled !== "boolean") {
      return apiError("A skill name and an enabled flag are required.");
    }

    await setProjectSkillEnabled(body.name, body.enabled);
    return Response.json({ updated: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update the skill";
    return apiError(error, message.includes("was not found") ? 404 : 400);
  }
}

export async function DELETE(request: Request) {
  const session = await requireRegularUser();
  if (!session) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  try {
    const body = (await request.json()) as { name?: unknown };
    if (typeof body.name !== "string") {
      return apiError("A skill name is required.");
    }

    await deleteProjectSkill(body.name);
    return Response.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return apiError(error, message.includes("was not found") ? 404 : 400);
  }
}
