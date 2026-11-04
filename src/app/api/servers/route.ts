import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { api } from "@/lib/api";
import { jsonObject, withSession } from "@/lib/proxy";
import type { CreateServerRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export function GET() {
  return withSession((token) => api.listServers(token));
}

export async function POST(request: NextRequest) {
  const body = await jsonObject(request);
  if (!body) return NextResponse.json({ message: "The request body must be JSON." }, { status: 400 });
  const payload: CreateServerRequest = { name: String(body.name ?? "").trim() };
  const motd = typeof body.motd === "string" ? body.motd.trim() : "";
  if (motd) payload.motd = motd;
  const operator = typeof body.operator_username === "string" ? body.operator_username.trim() : "";
  if (operator) payload.operator_username = operator;
  // dsh-api answers 202 with the server in state `provisioning`; the browser
  // then watches GET /api/servers/{name} until it is awake.
  return withSession((token) => api.createServer(token, payload), 202);
}
