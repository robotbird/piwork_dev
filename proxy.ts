import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (/\.[^/]+$/.test(pathname)) {
    return NextResponse.next();
  }

  // secureCookie 按请求协议而非 NODE_ENV 推导：authjs 服务端依协议决定
  // cookie 名（https → __Secure- 前缀）；本地 HTTP 下跑 next start 时两者
  // 若不一致，会话 cookie 永远对不上号，全站陷入登录重定向环。
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: request.nextUrl.protocol === "https:",
  });

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  const authenticated = token?.type === "regular";
  const isAuthPage = ["/login", "/register"].includes(pathname);
  if (!authenticated && !isAuthPage) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL(`${base}/login`, request.url));
  }
  if (authenticated && isAuthPage) {
    return NextResponse.redirect(new URL(`${base}/`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/chat/:id",
    "/api/:path*",
    "/login",
    "/register",

    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
