/** 获取当前登录用户 */

import { auth } from "@/app/(auth)/auth";

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}
