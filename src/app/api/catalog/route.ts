import { NextResponse } from "next/server";
import { api, ApiError, NOT_REACHABLE } from "@/lib/api";

export const dynamic = "force-dynamic";

// The catalog is public at dsh-api, so no session is needed; the browser
// still asks the portal rather than dsh-api, which it cannot reach.
export async function GET() {
  try {
    return NextResponse.json(await api.catalog());
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error(error);
    return NextResponse.json({ message: NOT_REACHABLE }, { status: 502 });
  }
}
