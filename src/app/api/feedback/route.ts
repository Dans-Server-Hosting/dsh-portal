import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { api } from "@/lib/api";
import { withSession } from "@/lib/proxy";
import { isFeedbackFilter, portalPathOrNull, type FeedbackRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Admin only upstream: a non-admin gets dsh-api's 403 passed straight through. */
export function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") ?? "new";
  if (!isFeedbackFilter(status)) return NextResponse.json({ message: "status must be new, read or all." }, { status: 400 });
  return withSession((token) => api.listFeedback(token, status));
}

export async function POST(request: NextRequest) {
  let body: FeedbackRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "The request body must be JSON." }, { status: 400 });
  }
  const payload: FeedbackRequest = { message: String(body.message ?? "").trim() };
  const page = portalPathOrNull(body.page);
  if (page) payload.page = page;
  return withSession((token) => api.submitFeedback(token, payload), 201);
}
