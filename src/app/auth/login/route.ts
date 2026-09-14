import { NextResponse, type NextRequest } from "next/server";
import { portalUrl, userAuthUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Sends the browser to UserAuth, which comes back to /auth/callback?token=... */
export function GET(request: NextRequest) {
  const callback = `${portalUrl(request.nextUrl.origin)}/auth/callback`;
  const target = new URL(`${userAuthUrl()}/login`);
  target.searchParams.set("redirect", callback);
  return NextResponse.redirect(target);
}
