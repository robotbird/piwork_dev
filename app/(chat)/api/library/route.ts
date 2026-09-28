import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createLibraryFolder,
  listLibraryItems,
} from "@/lib/db/library-queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "请先登录" }, { status: 401 });
  }
  return Response.json(await listLibraryItems(session.user.id));
}

const folderSchema = z.object({
  name: z.string().trim().min(1).max(180),
  parentId: z.uuid().nullable().default(null),
});
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "请先登录" }, { status: 401 });
  }
  const parsed = folderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "请输入有效的文件夹名称" }, { status: 400 });
  }
  try {
    return Response.json(
      await createLibraryFolder(
        session.user.id,
        parsed.data.name,
        parsed.data.parentId
      )
    );
  } catch {
    return Response.json({ error: "无法创建文件夹" }, { status: 400 });
  }
}
