import type { Metadata } from "next";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import ServerList from "@/components/ServerList";
import SessionExpired from "@/components/SessionExpired";
import { api, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/require-session";
import type { Limits, Server, WorldThumbnail } from "@/lib/types";

export const metadata: Metadata = { title: "My servers" };
export const dynamic = "force-dynamic";

export default async function ServersPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const session = await requireSession();
  const params = await searchParams;

  let servers: Server[] = [];
  let loadError: string | null = null;
  let limits: Limits | null = null;
  const thumbnails: Record<string, WorldThumbnail | null> = {};
  try {
    [servers, limits] = await Promise.all([api.listServers(session.token), api.limits().catch(() => null)]);
    // World thumbnails (RFC 0034) are decoration: asked for only while dsh-api
    // has them switched on, and a card without one renders exactly as before.
    if (limits?.thumbnail_mode === "manual") {
      const views = await Promise.all(
        servers.map((s) => api.getThumbnail(session.token, s.name).catch(() => null)),
      );
      servers.forEach((s, i) => (thumbnails[s.name] = views[i]));
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return <SessionExpired />;
    loadError = error instanceof ApiError ? error.message : "The hosting service is not reachable right now.";
  }

  return (
    <Stack spacing={2}>
      {params.deleted && <Alert severity="success">{params.deleted} was deleted. A backup was taken first.</Alert>}
      {loadError && <Alert severity="error">Your servers could not be loaded: {loadError}</Alert>}
      <ServerList initial={servers} maxServers={limits?.servers_per_tenant ?? null} thumbnails={thumbnails} />
    </Stack>
  );
}
