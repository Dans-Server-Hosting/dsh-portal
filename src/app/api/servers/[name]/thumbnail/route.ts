import type { NextRequest } from "next/server";
import { api } from "@/lib/api";
import { withSession } from "@/lib/proxy";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ name: string }> };

/** The server's world thumbnail (RFC 0034): its status and what it shows. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { name } = await params;
  return withSession((token) => api.getThumbnail(token, name));
}

/** Draw the picture again; 202 with `queued`. */
export async function POST(_request: NextRequest, { params }: Params) {
  const { name } = await params;
  return withSession((token) => api.refreshThumbnail(token, name), 202);
}
