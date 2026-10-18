"use client";
import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import { explain, portalFetch } from "@/lib/client";
import { usePolling } from "@/lib/usePolling";
import type { ExportArea, ExportLink, Limits, WorldExport, WorldExportList } from "@/lib/types";

// three.js and the usd-web viewer load only when a preview is opened.
const ExportViewer = dynamic(() => import("./ExportViewer"), {
  ssr: false,
  loading: () => <LinearProgress aria-label="Loading the 3D viewer" />,
});

export const EXPORT_POLL_MS = 5_000;
const IDLE_POLL_MS = 60_000;
const DEFAULT_SIZE = 256;
const DEFAULT_MAX_SIZE = 512;

const PHASE_TEXT: Record<string, string> = {
  starting: "Starting",
  copying: "Copying world",
  exporting: "Building 3D",
  preview: "Building 3D",
  packaging: "Building 3D",
};

export function progressText(item: WorldExport): string {
  if (item.status === "queued") return "Queued";
  if (item.status === "running") return item.phase ? PHASE_TEXT[item.phase] ?? "Working" : "Starting";
  if (item.status === "ready") return "Ready";
  return "Failed";
}

const active = (item: WorldExport) => item.status === "queued" || item.status === "running";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function expiresIn(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return "Expires shortly";
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 24) return `Kept for ${Math.round(hours / 24)} more day${Math.round(hours / 24) === 1 ? "" : "s"}`;
  if (hours >= 1) return `Kept for ${hours} more hour${hours === 1 ? "" : "s"}`;
  return `Kept for ${Math.max(1, Math.round(ms / 60_000))} more minutes`;
}

function areaText(area: WorldExport["area"]): string {
  if (!area) return "Around spawn";
  const w = Math.abs(area.x2 - area.x1) + 1;
  const d = Math.abs(area.z2 - area.z1) + 1;
  return `${w} × ${d} blocks, X ${area.x1}…${area.x2}, Z ${area.z1}…${area.z2}`;
}

function SnapshotNote({ item }: { item: WorldExport }) {
  if (item.snapshot === "live_changing") {
    return (
      <Alert severity="warning" data-testid="export-snapshot" data-snapshot="live_changing" sx={{ py: 0 }}>
        Your server was saving while it was copied — a few chunks may be missing or out of date. Export again while it is asleep for an
        exact copy.
      </Alert>
    );
  }
  if (!item.snapshot) return null;
  return (
    <Typography variant="body2" color="text.secondary" data-testid="export-snapshot" data-snapshot={item.snapshot}>
      {item.snapshot === "at_rest" ? "Exact copy (server was asleep)" : "Copied while running"}
    </Typography>
  );
}

/** What is wrong with the typed corners, or null when they can be sent. */
export function areaProblem(fields: Record<keyof ExportArea, string>, maxSize: number): string | null {
  const values = Object.values(fields);
  if (values.some((v) => v.trim() === "")) return "Fill in both corners.";
  if (values.some((v) => !/^-?\d+$/.test(v.trim()))) return "Corners are whole block coordinates, like -128 or 255.";
  const [x1, z1, x2, z2] = (["x1", "z1", "x2", "z2"] as const).map((k) => Number(fields[k]));
  if (Math.abs(x2 - x1) + 1 > maxSize || Math.abs(z2 - z1) + 1 > maxSize) {
    return `The area can be at most ${maxSize} × ${maxSize} blocks.`;
  }
  return null;
}

/**
 * Export world as 3D (RFC 0021): starts an export of a box of the world,
 * shows its progress, and offers a 3D preview and a zip download for each
 * finished one until it expires. The page renders this only when dsh-api has
 * world export switched on (its list call answers 503 otherwise).
 */
export default function WorldExportSection({
  server,
  initial,
  limits,
}: {
  server: string;
  initial: WorldExport[];
  limits: Limits | null;
}) {
  const base = `/api/servers/${encodeURIComponent(server)}/exports`;
  const defaultSize = limits?.export_default_size ?? DEFAULT_SIZE;
  const maxSize = limits?.export_max_size ?? DEFAULT_MAX_SIZE;
  const load = useCallback(() => portalFetch<WorldExportList>(base).then((r) => r.exports), [base]);
  // Every 5 s while an export is queued or running; otherwise only now and then, to drop expired ones.
  const [fast, setFast] = useState(initial.some((e) => e.status === "queued" || e.status === "running"));
  const { data: exports, setData, refresh } = usePolling(load, initial, fast ? EXPORT_POLL_MS : IDLE_POLL_MS);
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("sm"));

  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [fields, setFields] = useState<Record<keyof ExportArea, string>>({ x1: "", z1: "", x2: "", z2: "" });
  const [previewing, setPreviewing] = useState<WorldExport | null>(null);
  const [deleting, setDeleting] = useState<WorldExport | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const running = exports.some(active);
  if (running !== fast) setFast(running);
  const fieldProblem = choosing ? areaProblem(fields, maxSize) : null;

  async function start() {
    setError(null);
    if (choosing && fieldProblem) return;
    setStarting(true);
    try {
      const area = choosing
        ? { x1: Number(fields.x1), z1: Number(fields.z1), x2: Number(fields.x2), z2: Number(fields.z2) }
        : null;
      const created = await portalFetch<WorldExport>(base, { method: "POST", body: JSON.stringify(area ? { area } : {}) });
      setData([created, ...exports.filter((e) => e.id !== created.id)]);
    } catch (e) {
      setError(explain(e, "export"));
    } finally {
      setStarting(false);
    }
  }

  async function download(item: WorldExport) {
    setError(null);
    setBusyId(item.id);
    try {
      const link = await portalFetch<ExportLink>(`${base}/${encodeURIComponent(item.id)}/link`, { method: "POST" });
      window.location.assign(link.url);
    } catch (e) {
      setError(explain(e, "export"));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: WorldExport) {
    setError(null);
    setBusyId(item.id);
    try {
      await portalFetch<void>(`${base}/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      setData(exports.filter((e) => e.id !== item.id));
      setDeleting(null);
    } catch (e) {
      setDeleting(null);
      setError(explain(e, "export"));
      void refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card data-testid="export-section">
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle2" component="h2" gutterBottom>
              3D export
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Turn part of your world into a 3D model (OpenUSD, for Blender and other 3D tools) and look at it right here.{" "}
              <span data-testid="export-default-area">
                {defaultSize} × {defaultSize} blocks around spawn, every height.
              </span>{" "}
              Your world is only read, never changed.
            </Typography>
          </Box>
          {error && (
            <Alert severity="error" onClose={() => setError(null)} data-testid="export-error">
              {error}
            </Alert>
          )}
          <Collapse in={choosing} unmountOnExit>
            <Stack spacing={1.5} data-testid="export-area-form">
              <Typography variant="body2" color="text.secondary">
                Two opposite corners, in block coordinates (press F3 in game to see yours). Up to {maxSize} × {maxSize} blocks.
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                {(["x1", "z1", "x2", "z2"] as const).map((key) => (
                  <TextField
                    key={key}
                    label={`${key.startsWith("x") ? "X" : "Z"}, corner ${key.endsWith("1") ? "1" : "2"}`}
                    value={fields[key]}
                    onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                    size="small"
                    inputProps={{ inputMode: "numeric", "data-testid": `export-${key}` }}
                  />
                ))}
              </Box>
              {fieldProblem && (
                <Typography variant="body2" color="error" data-testid="export-area-problem">
                  {fieldProblem}
                </Typography>
              )}
            </Stack>
          </Collapse>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              variant="contained"
              onClick={start}
              disabled={starting || running || (choosing && fieldProblem !== null)}
              data-testid="export-start"
              sx={{ minHeight: 44 }}
            >
              {starting ? "Starting…" : "Export world as 3D"}
            </Button>
            <Button onClick={() => setChoosing(!choosing)} data-testid="export-choose-area" sx={{ minHeight: 44 }}>
              {choosing ? "Use the area around spawn" : "Choose area"}
            </Button>
          </Stack>
          {running && (
            <Typography variant="caption" color="text.secondary">
              One export at a time; this one usually takes under a minute.
            </Typography>
          )}

          {exports.length > 0 && (
            <Stack spacing={1.5} data-testid="export-list">
              {exports.map((item) => (
                <Box
                  key={item.id}
                  data-testid="export-item"
                  data-id={item.id}
                  data-status={item.status}
                  sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}
                >
                  <Stack spacing={0.75}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} data-testid="export-progress">
                        {progressText(item)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(item.created_at).toLocaleString()}
                      </Typography>
                    </Box>
                    {active(item) && <LinearProgress aria-label="Export in progress" />}
                    {item.status === "failed" && (
                      <Typography variant="body2" color="error" data-testid="export-failure">
                        {item.error ?? "The export did not finish."}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                      {areaText(item.area)}
                    </Typography>
                    {item.status === "ready" && (
                      <>
                        {item.stats && (
                          <Typography variant="body2" color="text.secondary" data-testid="export-stats">
                            {item.stats.instances.toLocaleString()} blocks · {formatBytes(item.stats.zip_bytes)} zip
                            {expiresIn(item.expires_at) ? ` · ${expiresIn(item.expires_at)}` : ""}
                          </Typography>
                        )}
                        <SnapshotNote item={item} />
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <Button variant="outlined" onClick={() => setPreviewing(item)} data-testid="export-preview" sx={{ minHeight: 44 }}>
                            Preview
                          </Button>
                          <Button
                            variant="outlined"
                            onClick={() => download(item)}
                            disabled={busyId === item.id}
                            data-testid="export-download"
                            sx={{ minHeight: 44 }}
                          >
                            Download (.zip)
                          </Button>
                          <Button color="error" onClick={() => setDeleting(item)} data-testid="export-delete" sx={{ minHeight: 44 }}>
                            Delete
                          </Button>
                        </Stack>
                      </>
                    )}
                    {item.status === "failed" && (
                      <Button
                        color="error"
                        onClick={() => setDeleting(item)}
                        data-testid="export-delete"
                        sx={{ minHeight: 44, alignSelf: "flex-start" }}
                      >
                        Remove
                      </Button>
                    )}
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>

      <Dialog
        open={previewing !== null}
        onClose={() => setPreviewing(null)}
        fullScreen={phone}
        fullWidth
        maxWidth="lg"
        aria-labelledby="export-preview-title"
      >
        <DialogTitle id="export-preview-title" sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>3D preview</Box>
          <IconButton aria-label="Close the preview" onClick={() => setPreviewing(null)} data-testid="export-preview-close" size="large">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: phone ? "100%" : "70vh" }} data-testid="export-preview-dialog">
          {previewing && (
            <ExportViewer baseUrl={`${base}/${encodeURIComponent(previewing.id)}/preview/`} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)}>
        <DialogTitle>Delete this export?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The 3D files and the preview are removed. Your world is not affected, and you can export again.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>Keep it</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => deleting && remove(deleting)}
            disabled={busyId !== null}
            data-testid="export-delete-confirm"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
