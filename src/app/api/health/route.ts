import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * What the Kubernetes probes ask. It says only that this process answers, so
 * it calls nothing upstream: probing a page instead would restart a healthy
 * portal whenever dsh-api was slow, and every page already says so itself
 * when the API is down.
 */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
