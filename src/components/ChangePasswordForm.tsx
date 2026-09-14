"use client";
import { useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { explain, portalFetch } from "@/lib/client";
import { PASSWORD_MAX, newPasswordProblem, newPasswordRules } from "@/lib/credentials";
import type { ChangePasswordRequest } from "@/lib/types";
import PasswordRules from "./PasswordRules";

/**
 * Current, new and confirm. The rules are checked as they are typed, the
 * same way registration does it; UserAuth stays the authority and whatever
 * it refuses is shown as it said it.
 */
export default function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  const rules = newPasswordRules(current, next);
  const problem = !current
    ? "Enter your current password."
    : (newPasswordProblem(current, next) ?? (confirm !== next ? "The two new passwords do not match." : null));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (problem) return;
    setBusy(true);
    setError(null);
    const body: ChangePasswordRequest = { currentPassword: current, newPassword: next };
    try {
      await portalFetch<void>("/api/account/password", { method: "POST", body: JSON.stringify(body) });
      setChanged(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      setTouched(false);
    } catch (e) {
      setError(explain(e, "password"));
    } finally {
      setBusy(false);
    }
  }

  if (changed) {
    return (
      <Stack spacing={2} data-testid="password-changed">
        <Alert severity="success">
          <AlertTitle>Your password was changed</AlertTitle>
          Use the new one from now on. Anywhere else you were signed in (another browser or phone) has been signed
          out; this session stays signed in.
        </Alert>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button component={Link} href="/servers" variant="contained">
            My servers
          </Button>
          <Button onClick={() => setChanged(false)}>Change it again</Button>
        </Stack>
      </Stack>
    );
  }

  return (
    <Box component="form" onSubmit={submit} noValidate>
      <Stack spacing={2.5}>
        <TextField
          label="Current password"
          type="password"
          required
          fullWidth
          autoComplete="current-password"
          disabled={busy}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          inputProps={{ "data-testid": "current-password-input", maxLength: PASSWORD_MAX }}
        />
        <Box>
          <TextField
            label="New password"
            type="password"
            required
            fullWidth
            autoComplete="new-password"
            disabled={busy}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            inputProps={{ "data-testid": "new-password-input", maxLength: PASSWORD_MAX }}
          />
          <PasswordRules rules={rules} />
        </Box>
        <TextField
          label="New password again"
          type="password"
          required
          fullWidth
          autoComplete="new-password"
          disabled={busy}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={touched && !!next && confirm !== next}
          helperText={touched && !!next && confirm !== next ? "The two new passwords do not match." : " "}
          inputProps={{ "data-testid": "confirm-password-input", maxLength: PASSWORD_MAX }}
        />
        {touched && problem && !error && (
          <Alert severity="warning" data-testid="password-problem">
            {problem}
          </Alert>
        )}
        {error && (
          <Alert severity="error" data-testid="password-error">
            {error}
          </Alert>
        )}
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button type="submit" variant="contained" disabled={busy} data-testid="change-password-submit">
            {busy ? "Changing…" : "Change password"}
          </Button>
          <Button component={Link} href="/servers" disabled={busy}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
