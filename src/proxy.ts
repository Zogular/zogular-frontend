import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_LOGIN_PATH,
  ADMIN_SESSION_COOKIE,
} from "@/services/admin/session-cookie";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith("/admin")) {
    const isLoginPage = path === ADMIN_LOGIN_PATH;
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

    if (!token && !isLoginPage) {
      return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
