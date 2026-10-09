import { eq } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { getDb } from "@/lib/db/client";
import {
  getLibraryItemById,
  readLibraryItemBytes,
} from "@/lib/db/library-queries";
import { getMemberByUserId } from "@/lib/db/organization-queries";
import { user } from "@/lib/db/schema";

/** 头像仅限这些图片类型（与上传端约束一致，含 gif 历史）。 */
const AVATAR_CONTENT_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/**
 * 用户头像投影（协作实时/分享链路专用）：
 *
 * 背景：`User.image` 保存本人 LibraryItem 预览地址 `/api/library/:id?preview=1`，
 * 该路由按本人归属鉴权——其他成员（协作者/共享对话参与者）直接加载会 404，
 * 导致参与者头像堆叠里只有当前登录者本人能显示图片。
 *
 * 本端点按 userId 服务端解析其 `User.image` 并输出字节，双归属校验：
 * 1. 必须是本平台 library 预览格式（严格前缀 + uuid，不代理任意 URL）；
 * 2. 解析出的 LibraryItem.userId 必须等于该 user（防把他人文件当头像读取）。
 *
 * 可见性：登录且启用成员（头像属企业内成员互可见的身份信息；参与者名单
 * 本身已按对话成员收敛）。未设置头像 → 404，前端回退首字母。
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return new Response(null, { status: 401 });
  }

  const viewer = await getMemberByUserId(session.user.id);
  if (viewer?.status !== "enabled") {
    return new Response(null, { status: 403 });
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(id)) {
    return new Response(null, { status: 404 });
  }

  const [target] = await getDb()
    .select({ image: user.image })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  if (!target?.image) {
    return new Response(null, { status: 404 });
  }

  // 只认本平台头像格式；历史外部 URL 一律拒绝（不做代理）
  const match = target.image.match(
    /^\/api\/library\/([0-9a-f-]{36})(?:\?preview=1)?$/
  );
  if (!match) {
    return new Response(null, { status: 404 });
  }

  const item = await getLibraryItemById(match[1]);
  if (!item || item.userId !== id) {
    return new Response(null, { status: 404 });
  }
  if (!AVATAR_CONTENT_TYPES.has(item.contentType ?? "")) {
    return new Response(null, { status: 404 });
  }

  const content = await readLibraryItemBytes(item);
  if (!content) {
    return new Response(null, { status: 404 });
  }

  // 头像由本人主动上传且低敏，允许短缓存减少重复拉取；仍 private 防共享缓存
  return new Response(content.bytes as BodyInit, {
    headers: {
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": "inline",
      "Content-Security-Policy": "sandbox",
      "Content-Type": content.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
