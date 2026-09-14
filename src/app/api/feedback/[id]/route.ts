import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { api } from "@/lib/api";
import { withSession } from "@/lib/proxy";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Admin only upstream: a non-admin gets dsh-api's 403 passed straight through. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId < 0) {
    return NextResponse.json({ message: "The feedback id must be a number." }, { status: 400 });
  }
  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "The request body must be JSON." }, { status: 400 });
  }
  if (body.status !== "read" && body.status !== "new") {
    return NextResponse.json({ message: "status must be read or new." }, { status: 400 });
  }
  const status = body.status;
  return withSession((token) => api.setFeedbackStatus(token, numericId, status));
}
