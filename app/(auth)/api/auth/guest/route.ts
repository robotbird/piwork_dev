import { NextResponse } from "next/server";

/** Legacy entry point: guest sessions can no longer be created. */
export function GET(request: Request) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return NextResponse.redirect(new URL(`${base}/login`, request.url));
}
