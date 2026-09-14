import type { Metadata } from "next";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import ServerList from "@/components/ServerList";
import { api, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/require-session";
import type { Limits, Server } from "@/lib/types";

export const metadata: Metadata = { title: "My servers" };
export const dynamic = "force-dynamic";

export default async function ServersPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const session = await requireSession();
  const params = await searchParams;

  let servers: Server[] = [];
  let loadError: string | null = null;
  let limits: Limits | null = null;
  try {
    [servers, limits] = await Promise.all([api.listServers(session.token), api.limits().catch(() => null)]);
  } catch (error) {
    loadError = error instanceof ApiError ? error.message : "The hosting service is not reachable right now.";
  }

  return (
    <Stack spacing={2}>
      {params.deleted && <Alert severity="success">{params.deleted} was deleted. A backup was taken first.</Alert>}
      {loadError && <Alert severity="error">Your servers could not be loaded: {loadError}</Alert>}
      <ServerList initial={servers} maxServers={limits?.max_servers_per_tenant ?? null} />
    </Stack>
  );
}
