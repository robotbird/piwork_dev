import { auth } from "@/app/(auth)/auth";
import {
  deleteManagedProjectSkill,
  loadManagedProjectSkillSummaries,
  registerManagedProjectSkill,
  setManagedProjectSkillEnabled,
} from "@/lib/ai/managed-skills";
import { getInstallableCatalogSkill } from "@/lib/ai/skill-catalog";
import {
  createProjectSkill,
  deleteProjectSkill,
  extractProjectSkillArchive,
  installProjectSkill,
  MAX_SKILL_UPLOAD_FILE_COUNT,
  MAX_SKILL_UPLOAD_FILE_SIZE,
  MAX_SKILL_UPLOAD_TOTAL_SIZE,
} from "@/lib/ai/skills";
import { getUserById } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

function apiError(error: unknown, status = 400) {
  return Response.json(
    { error: error instanceof Error ? error.message : "Unknown error" },
    { status }
  );
}

async function requireAdministrator() {
  const session = await auth();
  return session?.user?.type === "regular" ? session : null;
}

export async function GET() {
  const session = await requireAdministrator();
  if (!session) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { skills, diagnostics } = await loadManagedProjectSkillSummaries();
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

export async function POST(request: Request) {
  const session = await requireAdministrator();
  if (!session) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  let installedName: string | null = null;
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
      const created = await createProjectSkill({
        description: catalogSkill.description,
        displayName: catalogSkill.displayName,
        instructions: catalogSkill.instructions,
        name: catalogSkill.name,
      });
      installedName = created.name;
    } else {
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
        files.length === 1 &&
        files[0].name.toLocaleLowerCase().endsWith(".zip");
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
      const installed = await installProjectSkill({ files: uploadedFiles });
      installedName = installed.name;
    }

    const uploader = await getUserById(session.user.id);
    await registerManagedProjectSkill({
      name: installedName,
      uploadedBy: uploader?.id ?? null,
    });
    return Response.json({ name: installedName }, { status: 201 });
  } catch (error) {
    if (installedName) {
      await deleteProjectSkill(installedName).catch(() => undefined);
    }
    console.error("Failed to upload managed skill:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return apiError(error, message.includes("already exists") ? 409 : 400);
  }
}

export async function PATCH(request: Request) {
  const session = await requireAdministrator();
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
    await setManagedProjectSkillEnabled(body.name, body.enabled);
    return Response.json({ updated: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update the skill";
    return apiError(error, message.includes("was not found") ? 404 : 400);
  }
}

export async function DELETE(request: Request) {
  const session = await requireAdministrator();
  if (!session) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  try {
    const body = (await request.json()) as { name?: unknown };
    if (typeof body.name !== "string") {
      return apiError("A skill name is required.");
    }
    await deleteManagedProjectSkill(body.name);
    return Response.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return apiError(error, message.includes("was not found") ? 404 : 400);
  }
}
