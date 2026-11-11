import { NextResponse, type NextRequest } from "next/server";
import { fetchThumbnailFile, NOT_REACHABLE } from "@/lib/api";
import { getSession } from "@/lib/session";
import { THUMBNAIL_FILES, type ThumbnailFile } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ name: string; file: string }> };

const MEDIA: Record<ThumbnailFile, string> = { "thumb.webp": "image/webp", "poster.png": "image/png" };

/**
 * A world thumbnail's image (RFC 0034). The <img> on the card points here, so
 * the picture is same-origin and works only with the owner's session cookie;
 * the token stays on the server. Only the two thumbnail files are forwarded.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { name, file } = await params;
  if (!(THUMBNAIL_FILES as readonly string[]).includes(file)) {
    return NextResponse.json({ message: "not a thumbnail file" }, { status: 404 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "You are not signed in." }, { status: 401 });
  let upstream: Response;
  try {
    upstream = await fetchThumbnailFile(session.token, name, file, request.headers.get("if-none-match"));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: NOT_REACHABLE }, { status: 502 });
  }
  const headers: Record<string, string> = { "cache-control": "private, max-age=300" };
  const etag = upstream.headers.get("etag");
  if (etag) headers.etag = etag;
  if (upstream.status === 304) return new NextResponse(null, { status: 304, headers });
  if (!upstream.ok) {
    return NextResponse.json({ message: `picture not available (${upstream.status})` }, { status: upstream.status });
  }
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, { status: 200, headers: { ...headers, "content-type": MEDIA[file as ThumbnailFile] } });
}
