import { NextResponse, type NextRequest } from "next/server";
import { portalUrl } from "@/lib/config";
import { clearSession, getSession } from "@/lib/session";
import { userAuth } from "@/lib/userauth";

export const dynamic = "force-dynamic";

/**
 * Revokes the token at UserAuth (best effort) and clears the session cookie.
 * POST only, so a cross-site link cannot sign the user out.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (session) await userAuth.logout(session.token);
  const response = NextResponse.redirect(`${portalUrl(request.nextUrl.origin)}/`, { status: 303 });
  clearSession(response);
  return response;
}
