import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import {
  getSupportedAttachmentType,
  MAX_CHAT_ATTACHMENT_SIZE,
} from "@/lib/ai/attachment-types";
import { storeFile } from "@/lib/ai/file-store";

export async function POST(request: Request) {
  const t = await getTranslations("api");
  const fileSchema = z.object({
    file: z
      .instanceof(Blob)
      .refine((file) => file.size <= MAX_CHAT_ATTACHMENT_SIZE, {
        message: t("fileTooLarge"),
      }),
  });
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }

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

    const filename = (formData.get("file") as File).name;
    const attachmentType = getSupportedAttachmentType(filename);
    if (!attachmentType) {
      return NextResponse.json(
        { error: t("unsupportedFile") },
        { status: 400 }
      );
    }

    try {
      const data = await storeFile({
        buffer: await file.arrayBuffer(),
        contentType: attachmentType.mediaType,
        filename,
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
