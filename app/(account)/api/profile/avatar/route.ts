import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import { storeFile } from "@/lib/ai/file-store";
import { registerLibraryFile } from "@/lib/db/library-queries";
import { getMemberByUserId } from "@/lib/db/organization-queries";
import { updateProfileImage } from "@/lib/db/profile-queries";

/** Identity and the stored avatar reference are supplied only by the platform. */
export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.type !== "regular") {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const member = await getMemberByUserId(session.user.id);
  if (member?.status === "disabled") {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const form = await request.formData().catch(() => null);
  if (!form) {
    return Response.json({ error: "invalidAvatar" }, { status: 400 });
  }
  if (form.get("remove") === "true") {
    if (!(await updateProfileImage(session.user.id, null))) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    revalidatePath("/", "layout");
    return Response.json({ image: null });
  }
  const file = form.get("file");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 2 * 1024 * 1024
  ) {
    return Response.json({ error: "invalidAvatar" }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const png =
    bytes.length >= 24 &&
    Buffer.from(bytes.subarray(0, 8)).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );
  const jpeg =
    bytes.length >= 4 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255;
  const webp =
    bytes.length >= 16 &&
    Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP";
  const contentType = png
    ? "image/png"
    : jpeg
      ? "image/jpeg"
      : webp
        ? "image/webp"
        : null;
  if (!contentType || file.type !== contentType) {
    return Response.json({ error: "invalidAvatar" }, { status: 400 });
  }
  const extension = png ? "png" : jpeg ? "jpg" : "webp";
  const stored = await storeFile({
    buffer: bytes,
    contentType,
    filename: `avatar-${crypto.randomUUID()}.${extension}`,
  });
  const item = await registerLibraryFile({
    file: stored,
    size: file.size,
    source: "upload",
    userId: session.user.id,
  });
  const image = `/api/library/${item.id}?preview=1`;
  if (!(await updateProfileImage(session.user.id, image))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  revalidatePath("/", "layout");
  return Response.json({ image });
}
