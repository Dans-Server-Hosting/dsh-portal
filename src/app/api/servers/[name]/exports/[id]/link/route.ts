import type { NextRequest } from "next/server";
import { api } from "@/lib/api";
import { withSession } from "@/lib/proxy";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ name: string; id: string }> };

/** A short-lived signed download URL; the browser follows it without the session. */
export async function POST(_request: NextRequest, { params }: Params) {
  const { name, id } = await params;
  return withSession((token) => api.exportLink(token, name, id));
}
