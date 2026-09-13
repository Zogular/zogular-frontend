import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_LOGIN_PATH,
  ADMIN_SESSION_COOKIE,
} from "@/services/admin/session-cookie";
import { getAdminLoginPath } from "@/services/admin/verification-recovery";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isAccountSetupPage = path === "/admin/setup-account" || path === "/auth/setup-account";

  const next = () => {
    const response = NextResponse.next();
    if (isAccountSetupPage) {
      response.headers.set("Cache-Control", "no-store, private, max-age=0");
      response.headers.set("Referrer-Policy", "no-referrer");
      response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    }
    return response;
  };

  if (path.startsWith("/admin")) {
    const isLoginPage = path === ADMIN_LOGIN_PATH;
    const isCheckEmailPage = path === "/admin/check-email";
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

    if (!token && !isLoginPage && !isCheckEmailPage && !isAccountSetupPage) {
      return NextResponse.redirect(new URL(getAdminLoginPath(nextPath), request.url));
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-zogular-admin-next", nextPath);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    if (isAccountSetupPage) {
      response.headers.set("Cache-Control", "no-store, private, max-age=0");
      response.headers.set("Referrer-Policy", "no-referrer");
      response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    }
    return response;
  }

  return next();
}

export const config = {
  matcher: ["/admin/:path*", "/auth/setup-account"],
};
