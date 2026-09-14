"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { portalFetch } from "@/lib/client";
import { usePolling } from "@/lib/usePolling";
import type { Server } from "@/lib/types";
import ServerActions from "./ServerActions";
import ServerAddress from "./ServerAddress";
import StatePill from "./StatePill";

function formatWhen(iso: string | null): string {
  if (!iso) return "never";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "140px 1fr" }, gap: { xs: 0.25, sm: 2 }, alignItems: "center" }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

export default function ServerDetail({ initial }: { initial: Server }) {
  const router = useRouter();
  const load = useCallback(() => portalFetch<Server>(`/api/servers/${encodeURIComponent(initial.name)}`), [initial.name]);
  const { data: server, setData, error: pollError, updatedAt } = usePolling(load, initial);
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <Stack spacing={2}>
      <Button component={Link} href="/servers" startIcon={<ArrowBackIcon />} size="small" sx={{ alignSelf: "flex-start" }}>
        All servers
      </Button>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Typography variant="h1" component="h1" sx={{ overflowWrap: "anywhere", minWidth: 0 }}>
          {server.name}
        </Typography>
        <StatePill state={server.state} />
      </Box>
      {server.motd && (
        <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
          {server.motd}
        </Typography>
      )}
      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}
      {pollError && <Alert severity="warning">Could not refresh just now; showing the last known state.</Alert>}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Row label="Address">
              <ServerAddress hostname={server.hostname} />
            </Row>
            <Row label="State">
              <Typography variant="body2">
                {server.state === "awake"
                  ? `Awake${server.players_online !== null ? `, ${server.players_online} player${server.players_online === 1 ? "" : "s"} online` : ""}`
                  : server.state === "waking"
                    ? "Waking up; joinable in under a minute"
                    : server.state === "failed"
                      ? "Failed to start. Try Wake again, or check the dashboard."
                      : "Asleep. It wakes when a player joins, or when Wake is pressed."}
              </Typography>
            </Row>
            <Row label="Last woken">
              <Typography variant="body2" data-testid="last-woken">
                {formatWhen(server.last_woken)}
              </Typography>
            </Row>
            <Row label="Dashboard">
              <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                <a href={server.dashboard_url} target="_blank" rel="noopener noreferrer">
                  {server.dashboard_url}
                </a>
              </Typography>
            </Row>
          </Stack>
        </CardContent>
      </Card>
      <ServerActions
        server={server}
        size="medium"
        onChanged={setData}
        onDeleted={() => router.push("/servers?deleted=" + encodeURIComponent(server.name))}
        onError={setActionError}
      />
      <Typography variant="caption" color="text.secondary">
        {updatedAt ? `Refreshed ${updatedAt.toLocaleTimeString()}` : "Refreshes automatically every 10 seconds"}
      </Typography>
    </Stack>
  );
}
