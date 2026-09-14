"use client";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import { explain, portalFetch } from "@/lib/client";

interface Props {
  name: string;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

/**
 * Deleting is the one irreversible thing the portal can do, so the name has
 * to be typed back, and the dialog says up front that a backup is taken.
 */
export default function DeleteServerDialog({ name, open, onClose, onDeleted }: Props) {
  const [typed, setTyped] = useState("");
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playersOnline, setPlayersOnline] = useState(false);
  const matches = typed.trim() === name;

  function reset() {
    setTyped("");
    setForce(false);
    setError(null);
    setPlayersOnline(false);
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await portalFetch<void>(`/api/servers/${encodeURIComponent(name)}${force ? "?force=true" : ""}`, { method: "DELETE" });
      reset();
      onDeleted();
    } catch (e) {
      if (e instanceof Error && "status" in e && (e as { status: number }).status === 409) setPlayersOnline(true);
      setError(explain(e, "delete"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : () => { reset(); onClose(); }}
      fullWidth
      maxWidth="xs"
      aria-labelledby="delete-server-title"
    >
      <DialogTitle id="delete-server-title">Delete {name}?</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <DialogContentText>
          A backup of the world is taken first and kept for a while, but the server, its address and its settings are
          removed and the name becomes free for anyone to claim.
        </DialogContentText>
        <DialogContentText>
          Type <strong>{name}</strong> to confirm.
        </DialogContentText>
        <TextField
          autoFocus
          fullWidth
          label="Server name"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={busy}
          inputProps={{ "data-testid": "delete-confirm-input", autoCapitalize: "none", autoCorrect: "off", spellCheck: false }}
        />
        {playersOnline && (
          <FormControlLabel
            control={<Checkbox checked={force} onChange={(e) => setForce(e.target.checked)} data-testid="delete-force" />}
            label="Delete anyway, even though players are online"
          />
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => { reset(); onClose(); }} disabled={busy}>
          Keep it
        </Button>
        <Button
          onClick={confirm}
          color="error"
          variant="contained"
          disabled={!matches || busy || (playersOnline && !force)}
          data-testid="delete-confirm-button"
        >
          {busy ? "Deleting…" : "Delete server"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
