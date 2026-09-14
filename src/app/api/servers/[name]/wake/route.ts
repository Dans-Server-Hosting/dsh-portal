import type { NextRequest } from "next/server";
import { api } from "@/lib/api";
import { withSession } from "@/lib/proxy";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ name: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const { name } = await params;
  return withSession((token) => api.wakeServer(token, name), 202);
}
