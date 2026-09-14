"use client";
import { useState } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { explain, portalFetch } from "@/lib/client";
import { WAKEABLE_STATES, type Server } from "@/lib/types";
import DeleteServerDialog from "./DeleteServerDialog";

interface Props {
  server: Server;
  onChanged: (server: Server) => void;
  onDeleted: () => void;
  onError: (message: string | null) => void;
  size?: "small" | "medium";
}

/** Open dashboard / Wake / Delete, shared by the list card and the detail page. */
export default function ServerActions({ server, onChanged, onDeleted, onError, size = "small" }: Props) {
  const [waking, setWaking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canWake = WAKEABLE_STATES.includes(server.state);

  async function wake() {
    setWaking(true);
    onError(null);
    try {
      const updated = await portalFetch<Server>(`/api/servers/${encodeURIComponent(server.name)}/wake`, { method: "POST" });
      onChanged(updated);
    } catch (e) {
      onError(explain(e, "wake"));
    } finally {
      setWaking(false);
    }
  }

  return (
    <>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        <Button
          size={size}
          variant="outlined"
          component="a"
          href={server.dashboard_url}
          target="_blank"
          rel="noopener noreferrer"
          endIcon={<OpenInNewIcon />}
        >
          Open dashboard
        </Button>
        <Button
          size={size}
          variant="contained"
          onClick={wake}
          disabled={!canWake || waking}
          startIcon={<PowerSettingsNewIcon />}
          data-testid="wake-button"
        >
          {waking ? "Waking…" : "Wake"}
        </Button>
        <Button
          size={size}
          color="error"
          variant="text"
          onClick={() => setDeleting(true)}
          startIcon={<DeleteOutlineIcon />}
          data-testid="delete-button"
        >
          Delete
        </Button>
      </Stack>
      <DeleteServerDialog name={server.name} open={deleting} onClose={() => setDeleting(false)} onDeleted={() => { setDeleting(false); onDeleted(); }} />
    </>
  );
}
