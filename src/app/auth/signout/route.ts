import { NextResponse, type NextRequest } from "next/server";
import { portalUrl } from "@/lib/config";
import { SESSION_COOKIE, clearedSessionCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Clears the session cookie. POST only, so a cross-site link cannot sign the user out. */
export function POST(request: NextRequest) {
  const response = NextResponse.redirect(`${portalUrl(request.nextUrl.origin)}/`, { status: 303 });
  response.cookies.set(SESSION_COOKIE, "", clearedSessionCookieOptions());
  return response;
}
