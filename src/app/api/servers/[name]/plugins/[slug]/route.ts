import type { NextRequest } from "next/server";
import { api } from "@/lib/api";
import { withSession } from "@/lib/proxy";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ name: string; slug: string }> };

export async function PUT(_request: NextRequest, { params }: Params) {
  const { name, slug } = await params;
  return withSession((token) => api.addPlugin(token, name, slug));
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { name, slug } = await params;
  return withSession((token) => api.removePlugin(token, name, slug));
}
