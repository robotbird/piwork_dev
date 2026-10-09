import Form from "next/form";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { signOut } from "@/app/(auth)/auth";

async function signOutAction() {
  "use server";

  // next-auth 会把 redirectTo 解析成基于服务端检测 origin 的绝对 URL；
  // 生产环境在反代后，App Router 路由的 Request URL 会拼成
  // http://localhost:<port>/...（next start 未指定 hostname 时），
  // 浏览器会被带离站点。因此先清会话（redirect: false），
  // 再用相对路径跳转，兼容本地开发与任意线上入口（IP:端口 / 域名 / HTTPS）。
  await signOut({ redirect: false });
  redirect("/");
}

export async function SignOutForm() {
  const t = await getTranslations("chat");
  return (
    <Form action={signOutAction} className="w-full">
      <button
        className="w-full px-1 py-0.5 text-left text-red-500"
        type="submit"
      >
        {t("signOut")}
      </button>
    </Form>
  );
}
