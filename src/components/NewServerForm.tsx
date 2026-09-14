"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { explain, PortalError, portalFetch } from "@/lib/client";
import { serverNameProblem, type CreatedServer, type CreateServerRequest, type Server } from "@/lib/types";
import CreateProgress from "./CreateProgress";
import ServerAddress from "./ServerAddress";

export default function NewServerForm() {
  const [name, setName] = useState("");
  const [motd, setMotd] = useState("");
  const [operator, setOperator] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set from the API's 409 when another server of this account is still being created. */
  const [inProgress, setInProgress] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedServer | null>(null);
  const [online, setOnline] = useState(false);
  const onProgress = useCallback((server: Server) => setOnline(server.state === "awake"), []);

  const nameProblem = name ? serverNameProblem(name) : "A name is required.";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (nameProblem) return;
    setBusy(true);
    setError(null);
    setInProgress(null);
    const body: CreateServerRequest = { name: name.trim() };
    if (motd.trim()) body.motd = motd.trim();
    if (operator.trim()) body.operator_username = operator.trim();
    try {
      // 202: the server exists in state `provisioning`; the created view watches it from here.
      setCreated(await portalFetch<CreatedServer>("/api/servers", { method: "POST", body: JSON.stringify(body) }));
    } catch (e) {
      if (e instanceof PortalError && e.status === 409 && e.server) setInProgress(e.server);
      setError(explain(e, "create"));
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Stack spacing={2} data-testid="created">
        <Alert severity="success" data-testid="created-banner">
          <AlertTitle>{online ? `${created.name} is ready` : `${created.name} is being set up`}</AlertTitle>
          {online
            ? "Give your friends this address; they can join right now."
            : "Give your friends this address. It works as soon as the server is online, which usually takes about a minute; there is no need to stay on this page."}
        </Alert>
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Status
                </Typography>
                <CreateProgress initial={created} onChange={onProgress} />
              </Box>
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
          <Alert severity={inProgress ? "info" : "error"} data-testid="create-error">
            {error}
            {inProgress && (
              <>
                {" "}
                <Link href={`/servers/${encodeURIComponent(inProgress)}`} data-testid="in-progress-link">
                  See how {inProgress} is doing
                </Link>
                .
              </>
            )}
          </Alert>
        )}
        {busy && (
          <Box data-testid="create-progress" role="status" aria-live="polite">
            <LinearProgress sx={{ mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Creating your server. This usually takes about a minute; please leave this page open.
            </Typography>
          </Box>
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
