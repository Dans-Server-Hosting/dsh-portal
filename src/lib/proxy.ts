import "server-only";
import { NextResponse } from "next/server";
import { ApiError, NOT_REACHABLE } from "./api";
import { getSession } from "./session";
import type { ApiErrorBody } from "./types";

/**
 * Shared plumbing for the portal's own /api/servers* route handlers: the
 * browser calls these, and they call dsh-api with the token from the
 * httpOnly cookie. Upstream status codes are passed through unchanged so the
 * client can turn 403/409/422 into plain-language messages. A 502 from
 * dsh-api (a cluster operation failed) keeps its detail, which the API
 * writes to be shown; "not reachable" is only for a fetch that got no
 * response at all.
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
      return NextResponse.json(body, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ message: NOT_REACHABLE }, { status: 502 });
  }
}
