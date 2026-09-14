"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { portalFetch } from "@/lib/client";
import { usePolling } from "@/lib/usePolling";
import type { Server } from "@/lib/types";
import ServerCard from "./ServerCard";

interface Props {
  initial: Server[];
  maxServers: number | null;
}

/** The signed-in user's servers, refreshed every few seconds without a reload. */
export default function ServerList({ initial, maxServers }: Props) {
  const load = useCallback(() => portalFetch<Server[]>("/api/servers"), []);
  const { data: servers, setData, error: pollError, updatedAt, refresh } = usePolling(load, initial);
  const [actionError, setActionError] = useState<string | null>(null);
  const atCap = maxServers !== null && servers.length >= maxServers;

  function replace(updated: Server) {
    setData((current) => current.map((s) => (s.name === updated.name ? updated : s)));
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="h1" component="h1" sx={{ mr: "auto" }}>
          My servers
        </Typography>
        <Button
          component={Link}
          href="/servers/new"
          variant="contained"
          startIcon={<AddIcon />}
          disabled={atCap}
          data-testid="create-server-link"
        >
          Create server
        </Button>
      </Box>
      {atCap && (
        <Typography variant="body2" color="text.secondary">
          The free tier allows {maxServers} server per account. Delete one to create another.
        </Typography>
      )}
      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}
      {pollError && (
        <Alert severity="warning">Could not refresh just now; showing the last known state. ({pollError})</Alert>
      )}
      {servers.length === 0 ? (
        <Box sx={{ py: 6, textAlign: "center" }} data-testid="empty-state">
          <Typography variant="h3" component="p" gutterBottom>
            No servers yet
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Create one and you will have an address to give your friends in about a minute.
          </Typography>
          <Button component={Link} href="/servers/new" variant="contained" startIcon={<AddIcon />}>
            Create your first server
          </Button>
        </Box>
      ) : (
        servers.map((server) => (
          <ServerCard key={server.name} server={server} onChanged={replace} onDeleted={refresh} onError={setActionError} />
        ))
      )}
      <Typography variant="caption" color="text.secondary" data-testid="last-refresh">
        {updatedAt ? `Refreshed ${updatedAt.toLocaleTimeString()}` : "Refreshes automatically every 10 seconds"}
      </Typography>
    </Stack>
  );
}
