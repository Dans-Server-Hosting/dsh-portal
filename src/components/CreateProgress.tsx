"use client";
import { useCallback } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { CREATE_POLL_INTERVAL_MS, portalFetch } from "@/lib/client";
import { usePolling } from "@/lib/usePolling";
import type { Server } from "@/lib/types";

/** The words shown for each state while a freshly created server is watched. */
export function progressText(state: Server["state"]): string {
  switch (state) {
    case "provisioning":
      return "Setting up… usually about a minute";
    case "waking":
      return "Starting…";
    case "awake":
      return "Online — ready to join";
    case "stopped":
      return "Set up, but the game is stopped. Press Wake on the server page to start it.";
    case "failed":
      return "Setup failed. Try Wake on the server page, or check the dashboard.";
    default:
      return "Set up. It is asleep until the first player joins, then it wakes in under a minute.";
  }
}

/**
 * A live status line for a server that was just created: the API answers
 * the create with 202 and state `provisioning`, so this asks for the server
 * every few seconds until it is online (or has failed).
 */
export default function CreateProgress({ initial, onChange }: { initial: Server; onChange?: (server: Server) => void }) {
  const load = useCallback(async () => {
    const server = await portalFetch<Server>(`/api/servers/${encodeURIComponent(initial.name)}`);
    onChange?.(server);
    return server;
  }, [initial.name, onChange]);
  const { data: server, error } = usePolling(load, initial, CREATE_POLL_INTERVAL_MS);
  const settled = server.state === "awake" || server.state === "failed" || server.state === "stopped" || server.state === "asleep";
  const icon =
    server.state === "failed" ? (
      <ErrorOutlineIcon color="error" fontSize="small" />
    ) : settled ? (
      <CheckCircleIcon color="success" fontSize="small" />
    ) : (
      <CircularProgress size={16} thickness={5} />
    );
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }} role="status" aria-live="polite">
      {icon}
      <Typography variant="body2" data-testid="create-status" data-state={server.state} sx={{ fontWeight: 600 }}>
        {progressText(server.state)}
      </Typography>
      {error && !settled && (
        <Typography variant="caption" color="text.secondary">
          (could not refresh just now; still trying)
        </Typography>
      )}
    </Box>
  );
}
