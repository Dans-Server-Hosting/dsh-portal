"use client";
import { useCallback, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { explain, portalFetch, PortalError } from "@/lib/client";
import { andList } from "@/lib/text";
import { usePolling } from "@/lib/usePolling";
import type { AddedPlugins, ApplyResult, CatalogPlugin, RemovedPlugin, ServerPlugin, ServerPlugins } from "@/lib/types";
import PluginCatalogSheet from "./PluginCatalogSheet";

function StatusChip({ plugin }: { plugin: ServerPlugin }) {
  if (plugin.status === "pending") {
    return <Chip label="Installs at next start" size="small" color="warning" variant="outlined" data-testid="plugin-status" />;
  }
  if (plugin.status.startsWith("failed")) {
    return <Chip label="Did not install" size="small" color="error" variant="outlined" data-testid="plugin-status" title={plugin.status} />;
  }
  return null;
}

/**
 * The server's plugins (RFC 0020): what is installed, Add from the Dan's
 * Plugins catalog, Remove, and a banner while a change waits for the next
 * start. Changes are saved straight away; they take effect when the server
 * next starts, which for an awake server means a restart (asked first when
 * players are online).
 */
export default function PluginsSection({ initial }: { initial: ServerPlugins }) {
  const name = initial.server;
  const base = `/api/servers/${encodeURIComponent(name)}/plugins`;
  const load = useCallback(() => portalFetch<ServerPlugins>(base), [base]);
  const { data, setData } = usePolling(load, initial);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogPlugin[] | null>(null);
  const [removing, setRemoving] = useState<ServerPlugin | null>(null);
  const [unused, setUnused] = useState<string[]>([]);
  const [confirmPlayers, setConfirmPlayers] = useState<number | null>(null);
  const [restarting, setRestarting] = useState(false);

  const titles = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of catalog ?? []) map.set(p.slug, p.title);
    for (const p of data.plugins) map.set(p.slug, p.title);
    return map;
  }, [catalog, data.plugins]);
  const titleOf = (slug: string) => titles.get(slug) ?? slug;

  async function add(slug: string): Promise<string[] | null> {
    setError(null);
    try {
      const result = await portalFetch<AddedPlugins>(`${base}/${encodeURIComponent(slug)}`, { method: "PUT" });
      setData(result);
      setRestarting(false);
      return result.added;
    } catch (e) {
      setError(explain(e, "plugins"));
      return null;
    }
  }

  async function remove(slug: string): Promise<RemovedPlugin | null> {
    const result = await portalFetch<RemovedPlugin>(`${base}/${encodeURIComponent(slug)}`, { method: "DELETE" });
    setData(result);
    setRestarting(false);
    return result;
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    setError(null);
    try {
      const result = await remove(removing.slug);
      setUnused(result?.unused_dependencies ?? []);
      setRemoving(null);
    } catch (e) {
      setError(explain(e, "plugins"));
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  }

  async function removeUnused() {
    setBusy(true);
    setError(null);
    // Only what was offered, one at a time, each once nothing left needs it:
    // the API refuses to remove a plugin another selected plugin requires.
    const requires = new Map(data.plugins.map((p) => [p.slug, p.requires]));
    const offered = [...unused];
    let left = [...offered];
    let freed: string[] = [];
    try {
      while (left.length > 0) {
        const next = left.find((slug) => !left.some((other) => other !== slug && requires.get(other)?.includes(slug))) ?? left[0];
        const result = await remove(next);
        left = left.filter((slug) => slug !== next);
        freed = result?.unused_dependencies ?? [];
      }
      // Removing those can free further dependencies; they are offered in turn.
      setUnused(freed.filter((slug) => !offered.includes(slug)));
    } catch (e) {
      setError(explain(e, "plugins"));
      setUnused([]);
    } finally {
      setBusy(false);
    }
  }

  async function apply(confirm: boolean) {
    setBusy(true);
    setError(null);
    try {
      const result = await portalFetch<ApplyResult>(`${base}/apply`, {
        method: "POST",
        body: JSON.stringify({ confirm_players: confirm }),
      });
      setConfirmPlayers(null);
      setRestarting(result.applies === "restarting");
    } catch (e) {
      if (e instanceof PortalError && e.status === 409 && e.playersOnline !== undefined) {
        setConfirmPlayers(e.playersOnline);
      } else {
        setConfirmPlayers(null);
        setError(explain(e, "plugins"));
      }
    } finally {
      setBusy(false);
    }
  }

  const canRestart = data.state === "awake" || data.state === "stopped";
  const installedSlugs = new Set(data.plugins.map((p) => p.slug));

  return (
    <Card data-testid="plugins-section">
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="h6" component="h2">
              Plugins
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setSheetOpen(true)} data-testid="add-plugins">
              Add plugins
            </Button>
          </Box>

          {error && (
            <Alert severity="error" onClose={() => setError(null)} data-testid="plugins-error">
              {error}
            </Alert>
          )}

          {restarting && data.pending && (
            <Alert severity="success" data-testid="plugins-restarting">
              Restarting to apply your changes. Players can join again in about a minute.
            </Alert>
          )}
          {data.pending && !restarting && (
            <Alert severity={canRestart ? "warning" : "info"} data-testid="plugins-pending">
              {canRestart
                ? "Your changes are saved. They take effect when the server restarts."
                : "Your changes are saved. They take effect the next time the server starts."}
              {canRestart && (
                <Box sx={{ mt: 1 }}>
                  <Button color="inherit" variant="outlined" size="small" onClick={() => apply(false)} disabled={busy} data-testid="apply-button">
                    Restart to apply
                  </Button>
                </Box>
              )}
            </Alert>
          )}

          {unused.length > 0 && (
            <Alert severity="info" data-testid="unused-offer">
              {andList(unused.map(titleOf))} {unused.length === 1 ? "is" : "are"} no longer needed by anything.{" "}
              Remove {unused.length === 1 ? "it" : "them"} too?
              {/* Below the sentence, not beside it: at phone width the buttons would squeeze it into a column. */}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button color="inherit" variant="outlined" size="small" onClick={removeUnused} disabled={busy} data-testid="unused-remove">
                  Remove
                </Button>
                <Button color="inherit" size="small" onClick={() => setUnused([])} disabled={busy}>
                  Keep
                </Button>
              </Stack>
            </Alert>
          )}

          <Stack component="ul" spacing={1.25} sx={{ listStyle: "none", p: 0, m: 0 }} data-testid="installed-plugins">
            {data.plugins.map((plugin) => (
              <Box
                component="li"
                key={plugin.slug}
                data-testid="installed-plugin"
                data-slug={plugin.slug}
                sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                      {plugin.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>
                      {plugin.version}
                    </Typography>
                    <StatusChip plugin={plugin} />
                  </Box>
                  {plugin.required_by.length > 0 && (
                    <Typography variant="caption" color="text.secondary" data-testid="needed-by">
                      Needed by {andList(plugin.required_by.map(titleOf))}
                    </Typography>
                  )}
                </Box>
                <Button
                  size="small"
                  color="inherit"
                  variant="outlined"
                  onClick={() => setRemoving(plugin)}
                  disabled={busy || plugin.required_by.length > 0}
                  aria-label={`Remove ${plugin.title}`}
                  data-testid="remove-plugin"
                  sx={{ flexShrink: 0, minHeight: 36 }}
                >
                  Remove
                </Button>
              </Box>
            ))}
          </Stack>
          {data.plugins.length === 0 && (
            <Typography variant="body2" color="text.secondary" data-testid="no-plugins">
              No plugins yet. Add some from the Dan&apos;s Plugins catalog.
            </Typography>
          )}

          <Typography variant="caption" color="text.secondary">
            Removing a plugin keeps its data, so adding it back later picks up where it left off. Plugins that are not in
            the catalog can still be uploaded from the dashboard.
          </Typography>
        </Stack>
      </CardContent>

      <PluginCatalogSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        catalog={catalog}
        onCatalog={setCatalog}
        installed={installedSlugs}
        onInstall={add}
      />

      <Dialog open={removing !== null} onClose={busy ? undefined : () => setRemoving(null)} fullWidth maxWidth="xs" aria-labelledby="remove-plugin-title">
        <DialogTitle id="remove-plugin-title">Remove {removing?.title}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            It is taken off the next time the server starts. Its data stays on the server, so adding it back later picks
            up where it left off.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoving(null)} disabled={busy}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={confirmRemove} disabled={busy} data-testid="remove-confirm">
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmPlayers !== null}
        onClose={busy ? undefined : () => setConfirmPlayers(null)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="restart-players-title"
      >
        <DialogTitle id="restart-players-title">
          {confirmPlayers} player{confirmPlayers === 1 ? " is" : "s are"} online. Restart now?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            They are told in chat first, then disconnected while the server restarts, and can join again in about a
            minute. Or wait: the changes also take effect the next time the server goes to sleep and wakes.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmPlayers(null)} disabled={busy}>
            Not now
          </Button>
          <Button color="warning" variant="contained" onClick={() => apply(true)} disabled={busy} data-testid="restart-confirm">
            Restart now
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
