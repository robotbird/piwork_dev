import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import {
  getSupportedAttachmentType,
  MAX_CHAT_ATTACHMENT_SIZE,
  SUPPORTED_ATTACHMENT_LABEL,
} from "@/lib/ai/attachment-types";

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
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileBuffer = await file.arrayBuffer();

    try {
      const data = await put(`${safeName}`, fileBuffer, {
        access: "public",
        addRandomSuffix: true,
        contentType: attachmentType.mediaType,
      });

      return NextResponse.json({
        ...data,
        contentType: attachmentType.mediaType,
        name: filename,
      });
    } catch {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
