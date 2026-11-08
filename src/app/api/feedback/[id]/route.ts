import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { api } from "@/lib/api";
import { jsonObject, withSession } from "@/lib/proxy";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Admin only upstream: a non-admin gets dsh-api's 403 passed straight through. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  // Digits only: Number() alone would read "0x1", "1e0", "1.0" or " 1" as item 1.
  const numericId = /^\d+$/.test(id) ? Number(id) : NaN;
  if (!Number.isSafeInteger(numericId)) {
    return NextResponse.json({ message: "The feedback id must be a number." }, { status: 400 });
  }
  const body = await jsonObject(request);
  if (!body) return NextResponse.json({ message: "The request body must be JSON." }, { status: 400 });
  if (body.status !== "read" && body.status !== "new") {
    return NextResponse.json({ message: "status must be read or new." }, { status: 400 });
  }
  const status = body.status;
  return withSession((token) => api.setFeedbackStatus(token, numericId, status));
}
