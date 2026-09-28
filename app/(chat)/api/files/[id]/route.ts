import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { auth } from "@/app/(auth)/auth";
import { readLocalFile } from "@/lib/ai/file-store";
import { canReadStoredFile } from "@/lib/db/library-queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations("api");
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }

  const { id } = await params;
  if (!(await canReadStoredFile(session.user.id, `/api/files/${id}`))) {
    return new Response(null, { status: 404 });
  }
  const file = await readLocalFile(id);
  if (!file) {
    return NextResponse.json({ error: t("fileNotFound") }, { status: 404 });
  }

  // ?download 参数触发浏览器下载而非内联预览（如生成的 pptx 附件卡片）。
  const download =
    new URL(request.url).searchParams.has("download") ||
    !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
      file.contentType
    );

  return new Response(new Uint8Array(file.content), {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(
        file.name
      )}`,
      "content-security-policy": "sandbox",
      "content-type": file.contentType,
      "x-content-type-options": "nosniff",
    },
  });
}
