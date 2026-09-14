import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { api } from "@/lib/api";
import { withSession } from "@/lib/proxy";
import type { CreateServerRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export function GET() {
  return withSession((token) => api.listServers(token));
}

export async function POST(request: NextRequest) {
  let body: CreateServerRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "The request body must be JSON." }, { status: 400 });
  }
  const payload: CreateServerRequest = { name: String(body.name ?? "").trim() };
  if (body.motd?.trim()) payload.motd = body.motd.trim();
  if (body.operator_username?.trim()) payload.operator_username = body.operator_username.trim();
  return withSession((token) => api.createServer(token, payload), 201);
}
