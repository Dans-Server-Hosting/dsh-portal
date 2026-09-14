import type { NextRequest } from "next/server";
import { api } from "@/lib/api";
import { withSession } from "@/lib/proxy";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ name: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { name } = await params;
  return withSession((token) => api.getServer(token, name));
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { name } = await params;
  const force = request.nextUrl.searchParams.get("force") === "true";
  return withSession((token) => api.deleteServer(token, name, force));
}
