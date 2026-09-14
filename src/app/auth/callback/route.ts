import { NextResponse, type NextRequest } from "next/server";
import { portalUrl } from "@/lib/config";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * UserAuth lands here with ?token=<jwt>. The token goes straight into an
 * httpOnly cookie and the browser is redirected away, so the token never
 * appears in a rendered page and never reaches client-side JavaScript.
 */
export function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const base = portalUrl(request.nextUrl.origin);
  if (!token || token.split(".").length !== 3) {
    return NextResponse.redirect(`${base}/?error=sign-in-failed`);
  }
  const response = NextResponse.redirect(`${base}/servers`);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(token));
  return response;
}
