import { NextResponse } from "next/server";

const AUTH_COOKIE_NAMES = ["accessToken", "refreshToken", "_csrf"];

/**
 * GET /api/auth/clear-session
 * Force-expires all auth cookies on the browser by setting Max-Age=0.
 * This is needed when cookies are HttpOnly and can't be cleared by JS.
 */
export function GET() {
  const response = NextResponse.json({ cleared: true });

  for (const name of AUTH_COOKIE_NAMES) {
    // Expire the cookie for localhost (dev)
    response.headers.append(
      "Set-Cookie",
      `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    );
  }

  return response;
}
