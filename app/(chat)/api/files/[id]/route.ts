import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { auth } from "@/app/(auth)/auth";
import { readLocalFile } from "@/lib/ai/file-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations("api");
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }

  const { id } = await params;
  const file = await readLocalFile(id);
  if (!file) {
    return NextResponse.json({ error: t("fileNotFound") }, { status: 404 });
  }

  // ?download 参数触发浏览器下载而非内联预览（如生成的 pptx 附件卡片）。
  const download = new URL(request.url).searchParams.has("download");

  return new Response(new Uint8Array(file.content), {
    headers: {
      "cache-control": "private, max-age=31536000, immutable",
      "content-disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(
        file.name
      )}`,
      "content-type": file.contentType,
    },
  });
}
