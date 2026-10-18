import type { NextRequest } from "next/server";
import { api } from "@/lib/api";
import { withSession } from "@/lib/proxy";
import type { ExportArea } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ name: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { name } = await params;
  return withSession((token) => api.listExports(token, name));
}

function areaFrom(body: unknown): ExportArea | null {
  const area = (body as { area?: unknown } | null)?.area;
  if (!area || typeof area !== "object") return null;
  const { x1, z1, x2, z2 } = area as Record<string, unknown>;
  const ints = [x1, z1, x2, z2];
  if (!ints.every((v) => typeof v === "number" && Number.isInteger(v))) return null;
  return { x1: x1 as number, z1: z1 as number, x2: x2 as number, z2: z2 as number };
}

export async function POST(request: NextRequest, { params }: Params) {
  const { name } = await params;
  let area: ExportArea | null = null;
  try {
    area = areaFrom(await request.json());
  } catch {
    // no body: the default box around spawn
  }
  return withSession((token) => api.startExport(token, name, area), 202);
}
