"use server";

import { compare, hash } from "bcrypt-ts";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { getMemberByUserId } from "@/lib/db/organization-queries";
import {
  updateProfileName,
  updateProfilePassword,
} from "@/lib/db/profile-queries";
import { getUserById } from "@/lib/db/queries";

export async function saveProfile(
  input: { name: string } | { currentPassword: string; newPassword: string }
) {
  const session = await auth();
  if (session?.user?.type !== "regular") {
    return { error: "unauthorized" };
  }
  const member = await getMemberByUserId(session.user.id);
  if (member?.status === "disabled") {
    return { error: "unauthorized" };
  }
  const parsed = z
    .union([
      z.object({ name: z.string().trim().min(1).max(64) }).strict(),
      z
        .object({
          currentPassword: z.string().min(1).max(1024),
          newPassword: z
            .string()
            .min(8)
            .refine((value) => new TextEncoder().encode(value).length <= 72),
        })
        .strict(),
    ])
    .safeParse(input);
  if (!parsed.success) {
    return {
      error:
        input && typeof input === "object" && "name" in input
          ? "invalidName"
          : "invalidPassword",
    };
  }
  const { data } = parsed;
  if ("name" in data) {
    await updateProfileName(session.user.id, data.name);
  } else {
    const account = await getUserById(session.user.id);
    if (
      !account?.password ||
      !(await compare(data.currentPassword, account.password))
    ) {
      return { error: "wrongPassword" };
    }
    if (
      !(await updateProfilePassword(
        session.user.id,
        account.password,
        await hash(data.newPassword, 10)
      ))
    ) {
      return { error: "wrongPassword" };
    }
  }
  revalidatePath("/", "layout");
  return { success: true };
}
