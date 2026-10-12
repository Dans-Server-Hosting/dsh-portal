import type { NextRequest } from "next/server";
import { api } from "@/lib/api";
import { withSession } from "@/lib/proxy";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ name: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { name } = await params;
  let confirmPlayers = false;
  try {
    const body = await request.json();
    confirmPlayers = body?.confirm_players === true;
  } catch {
    // no body: not confirmed
  }
  return withSession((token) => api.applyPlugins(token, name, confirmPlayers), 202);
}
