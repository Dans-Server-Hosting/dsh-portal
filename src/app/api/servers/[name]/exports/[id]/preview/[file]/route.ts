import { NextResponse, type NextRequest } from "next/server";
import { fetchExportPreview, NOT_REACHABLE } from "@/lib/api";
import { getSession } from "@/lib/session";
import { PREVIEW_FILE_PATTERN } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ name: string; id: string; file: string }> };

/**
 * The usd-web viewer fetches index.json and its tiles relative to this
 * directory, so it stays same-origin and the token stays on the server.
 * Bytes pass through untouched: tiles are gzip binaries the viewer decodes.
 * Only the two usd-web file shapes are forwarded.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const { name, id, file } = await params;
  if (!PREVIEW_FILE_PATTERN.test(file)) return NextResponse.json({ message: "not a preview file" }, { status: 404 });
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "You are not signed in." }, { status: 401 });
  let upstream: Response;
  try {
    upstream = await fetchExportPreview(session.token, name, id, file);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: NOT_REACHABLE }, { status: 502 });
  }
  if (!upstream.ok) {
    return NextResponse.json({ message: `preview file not available (${upstream.status})` }, { status: upstream.status });
  }
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": file.endsWith(".json") ? "application/json" : "application/octet-stream",
      // A ready export never changes; its tiles are content-addressed. The index is small.
      "cache-control": file.endsWith(".uwt") ? "private, max-age=3600, immutable" : "private, no-store",
    },
  });
}
