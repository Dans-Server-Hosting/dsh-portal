import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * What the Kubernetes probes ask. It says only that this process answers, so
 * it calls nothing upstream: probing the home page, which calls dsh-api, would
 * restart a healthy portal whenever the API was slow.
 */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
