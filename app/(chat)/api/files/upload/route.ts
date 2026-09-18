import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import {
  getSupportedAttachmentType,
  MAX_CHAT_ATTACHMENT_SIZE,
  SUPPORTED_ATTACHMENT_LABEL,
} from "@/lib/ai/attachment-types";
import { storeFile } from "@/lib/ai/file-store";

const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= MAX_CHAT_ATTACHMENT_SIZE, {
      message: "文件大小不能超过 20 MB",
    }),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

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
        { error: `不支持该文件格式。支持：${SUPPORTED_ATTACHMENT_LABEL}` },
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
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (error) {
    console.error("[files/upload] failed to process request", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
