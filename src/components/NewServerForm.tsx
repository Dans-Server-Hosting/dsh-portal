"use client";
import { useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { explain, portalFetch } from "@/lib/client";
import { serverNameProblem, type CreatedServer, type CreateServerRequest } from "@/lib/types";
import ServerAddress from "./ServerAddress";

export default function NewServerForm() {
  const [name, setName] = useState("");
  const [motd, setMotd] = useState("");
  const [operator, setOperator] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedServer | null>(null);

  const nameProblem = name ? serverNameProblem(name) : "A name is required.";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (nameProblem) return;
    setBusy(true);
    setError(null);
    const body: CreateServerRequest = { name: name.trim() };
    if (motd.trim()) body.motd = motd.trim();
    if (operator.trim()) body.operator_username = operator.trim();
    try {
      setCreated(await portalFetch<CreatedServer>("/api/servers", { method: "POST", body: JSON.stringify(body) }));
    } catch (e) {
      setError(explain(e, "create"));
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Stack spacing={2} data-testid="created">
        <Alert severity="success">
          <AlertTitle>{created.name} is ready</AlertTitle>
          Give your friends this address. The server is asleep until the first player joins, then it takes under a
          minute to wake.
        </Alert>
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Address
                </Typography>
                <ServerAddress hostname={created.hostname} />
              </Box>
              {created.admin_password && (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Dashboard password
                  </Typography>
                  <ServerAddress hostname={created.admin_password} />
                  <Typography variant="caption" color="warning.main">
                    Shown once only. Save it somewhere safe; it cannot be shown again.
                  </Typography>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button component={Link} href={`/servers/${encodeURIComponent(created.name)}`} variant="contained" data-testid="view-created">
            View server
          </Button>
          <Button component={Link} href="/servers">
            All servers
          </Button>
        </Stack>
      </Stack>
    );
  }

  return (
    <Box component="form" onSubmit={submit} noValidate>
      <Stack spacing={2.5}>
        <TextField
          label="Server name"
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase())}
          onBlur={() => setTouched(true)}
          required
          fullWidth
          error={touched && !!nameProblem}
          helperText={
            touched && nameProblem ? nameProblem : "Becomes part of the address. Lowercase letters, digits and hyphens."
          }
          inputProps={{ "data-testid": "name-input", autoCapitalize: "none", autoCorrect: "off", spellCheck: false, maxLength: 31 }}
          disabled={busy}
        />
        <TextField
          label="Message of the day"
          value={motd}
          onChange={(e) => setMotd(e.target.value)}
          fullWidth
          helperText="Optional. Shown in the Minecraft server list."
          inputProps={{ "data-testid": "motd-input", maxLength: 120 }}
          disabled={busy}
        />
        <TextField
          label="Your Minecraft username"
          value={operator}
          onChange={(e) => setOperator(e.target.value)}
          fullWidth
          helperText="Optional. This player is made an operator so you can run commands in game."
          inputProps={{ "data-testid": "operator-input", autoCapitalize: "none", autoCorrect: "off", spellCheck: false, maxLength: 16 }}
          disabled={busy}
        />
        {error && (
          <Alert severity="error" data-testid="create-error">
            {error}
          </Alert>
        )}
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button type="submit" variant="contained" disabled={busy} data-testid="create-submit">
            {busy ? "Creating…" : "Create server"}
          </Button>
          <Button component={Link} href="/servers" disabled={busy}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
