import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { getSupportedAttachmentType } from "@/lib/ai/attachment-types";
import { storeFile } from "@/lib/ai/file-store";
import {
  assertLibraryFolder,
  registerLibraryFile,
} from "@/lib/db/library-queries";
import { getUploadSettings } from "@/lib/db/upload-settings-queries";
import { type UploadSettings, uploadLimitBytes } from "@/lib/uploads/settings";

export async function POST(request: Request) {
  const t = await getTranslations("api");
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }

  let settings: UploadSettings;
  try {
    settings = await getUploadSettings();
  } catch {
    return NextResponse.json(
      { error: t("uploadSettingsUnavailable") },
      { status: 503 }
    );
  }
  const fileSchema = z.object({
    file: z
      .instanceof(Blob)
      .refine((file) => file.size <= uploadLimitBytes(settings), {
        message: t("fileTooLarge", { maxMB: settings.maxFileSizeMB }),
      }),
  });

  if (request.body === null) {
    return new Response(t("requestBodyEmpty"), { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: t("fileRequired") }, { status: 400 });
    }

    const validatedFile = fileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.issues
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const parentId = formData.get("parentId");
    if (
      parentId &&
      (typeof parentId !== "string" || !z.uuid().safeParse(parentId).success)
    ) {
      return NextResponse.json({ error: t("folderInvalid") }, { status: 400 });
    }
    try {
      await assertLibraryFolder(session.user.id, parentId as string | null);
    } catch {
      return NextResponse.json({ error: t("folderMissing") }, { status: 400 });
    }
    const isLibraryUpload = formData.get("library") === "true";
    const filename = (formData.get("file") as File).name;
    const attachmentType = getSupportedAttachmentType(filename);
    if (!attachmentType && !isLibraryUpload) {
      return NextResponse.json(
        { error: t("unsupportedFile") },
        { status: 400 }
      );
    }

    try {
      const data = await storeFile({
        buffer: await file.arrayBuffer(),
        contentType: attachmentType?.mediaType ?? "application/octet-stream",
        filename,
      });

      await registerLibraryFile({
        file: data,
        parentId: parentId as string | null,
        size: file.size,
        source: "upload",
        userId: session.user.id,
      });
      return NextResponse.json(data);
    } catch (error) {
      console.error("[files/upload] failed to store file", error);
      return NextResponse.json({ error: t("uploadFailed") }, { status: 500 });
    }
  } catch (error) {
    console.error("[files/upload] failed to process request", error);
    return NextResponse.json({ error: t("requestFailed") }, { status: 500 });
  }
}
