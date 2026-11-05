import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ApiError, NOT_REACHABLE } from "./api";
import { clearSession, getSession } from "./session";
import type { ApiErrorBody } from "./types";

/**
 * The request's body when it is a JSON object; null for anything else (not
 * JSON, or JSON such as `null` or a list), which a handler answers as a 400.
 */
export async function jsonObject(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Shared plumbing for the portal's own /api/servers* route handlers: the
 * browser calls these, and they call dsh-api with the token from the
 * httpOnly cookie. Upstream status codes are passed through unchanged so the
 * client can turn 403/409/422 into plain-language messages. A 502 from
 * dsh-api (a cluster operation failed) keeps its detail, which the API
 * writes to be shown; "not reachable" is only for a fetch that got no
 * response at all. A 401 from dsh-api means the token is dead, so the cookie
 * goes with it: the sign-in page sends anyone with a cookie back to /servers.
 */
export async function withSession<T>(
  handler: (token: string) => Promise<T>,
  successStatus = 200,
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "You are not signed in." }, { status: 401 });
  try {
    const result = await handler(session.token);
    if (result === undefined) return new NextResponse(null, { status: 204 });
    return NextResponse.json(result, { status: successStatus });
  } catch (error) {
    if (error instanceof ApiError) {
      const body: ApiErrorBody = { message: error.message };
      if (error.server) body.server = error.server;
      if (error.playersOnline !== undefined) body.players_online = error.playersOnline;
      if (error.retryAfter !== undefined) body.retry_after = error.retryAfter;
      const response = NextResponse.json(body, { status: error.status });
      if (error.status === 401) clearSession(response);
      return response;
    }
    console.error(error);
    return NextResponse.json({ message: NOT_REACHABLE }, { status: 502 });
  }
}
