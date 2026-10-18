import type { NextRequest } from "next/server";
import { api } from "@/lib/api";
import { withSession } from "@/lib/proxy";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ name: string; id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { name, id } = await params;
  return withSession((token) => api.getExport(token, name, id));
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { name, id } = await params;
  return withSession((token) => api.deleteExport(token, name, id));
}
