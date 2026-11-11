"use client";
import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import { formatWait, PortalError, portalFetch } from "@/lib/client";
import type { WorldThumbnail } from "@/lib/types";

export const THUMBNAIL_POLL_MS = 3_000;
const WIDTH = 200;
const HEIGHT = 132;

const active = (t: WorldThumbnail | null) => t?.status === "queued" || t?.status === "running";

/** Same-origin portal paths: they work only with the owner's session cookie. */
export function thumbnailUrl(server: string, file: "thumb.webp" | "poster.png", renderedAt: string): string {
  return `/api/servers/${encodeURIComponent(server)}/thumbnail/${file}?v=${encodeURIComponent(renderedAt)}`;
}

/**
 * The looping picture (RFC 0034 §1): the animated WebP, or its first frame as
 * a still for anyone who asked for reduced motion. The box keeps its aspect
 * ratio while the image loads, so nothing on the card moves.
 */
export function ThumbnailPicture({
  server,
  renderedAt,
  large = false,
}: {
  server: string;
  renderedAt: string;
  large?: boolean;
}) {
  return (
    <Box
      component="picture"
      data-testid="thumbnail-picture"
      sx={{
        display: "block",
        width: large ? { xs: "100%", sm: 2 * WIDTH } : { xs: "100%", sm: WIDTH },
        maxWidth: "100%",
        aspectRatio: `${WIDTH} / ${HEIGHT}`,
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "action.hover",
      }}
    >
      <source srcSet={thumbnailUrl(server, "poster.png", renderedAt)} media="(prefers-reduced-motion: reduce)" />
      {/* A same-origin, session-only image: next/image would cache it on the server for everyone. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbnailUrl(server, "thumb.webp", renderedAt)}
        alt={`3D picture of the world around spawn on ${server}`}
        width={WIDTH}
        height={HEIGHT}
        loading="lazy"
        data-testid="thumbnail-img"
        style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
      />
    </Box>
  );
}

function asOf(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function refreshError(error: unknown): string {
  if (error instanceof PortalError) {
    if (error.status === 429) {
      return error.retryAfter !== undefined
        ? `The picture can be refreshed a few times a day. Try again in ${formatWait(error.retryAfter)}.`
        : "The picture can be refreshed a few times a day. Try again later.";
    }
    return error.message.charAt(0).toUpperCase() + error.message.slice(1).replace(/([^.])$/, "$1.");
  }
  return "The picture could not be refreshed. Try again in a moment.";
}

/**
 * The detail page's picture of the world (RFC 0034): shown only while dsh-api
 * has thumbnails switched on. `initial` is null when there is no picture yet.
 */
export default function WorldThumbnailSection({ server, initial }: { server: string; initial: WorldThumbnail | null }) {
  const [thumb, setThumb] = useState<WorldThumbnail | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setThumb(await portalFetch<WorldThumbnail>(`/api/servers/${encodeURIComponent(server)}/thumbnail`));
    } catch (e) {
      if (e instanceof PortalError && e.status === 404) setThumb(null);
    }
  }, [server]);

  useEffect(() => {
    if (!active(thumb)) return;
    const timer = setInterval(load, THUMBNAIL_POLL_MS);
    return () => clearInterval(timer);
  }, [thumb, load]);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      setThumb(await portalFetch<WorldThumbnail>(`/api/servers/${encodeURIComponent(server)}/thumbnail`, { method: "POST" }));
    } catch (e) {
      setError(refreshError(e));
    } finally {
      setBusy(false);
    }
  }

  const picture = thumb?.has_picture && thumb.rendered_at ? thumb.rendered_at : null;
  const drawing = active(thumb);

  return (
    <Card data-testid="thumbnail-section" data-status={thumb?.status ?? "none"}>
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2" component="h2">
            Your world
          </Typography>
          {picture ? (
            <>
              <ThumbnailPicture server={server} renderedAt={picture} large />
              <Typography variant="body2" color="text.secondary" data-testid="thumbnail-caption">
                Around spawn, as of {asOf(picture)}. Drawn from a copy of your world; your world itself is never changed.
              </Typography>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" data-testid="thumbnail-none">
              No picture of your world yet. One can be drawn from a copy of the area around spawn; your world itself is never
              changed.
            </Typography>
          )}
          {drawing && (
            <Box data-testid="thumbnail-progress">
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                {thumb?.status === "queued" ? "Waiting its turn to be drawn…" : "Drawing the picture…"}
              </Typography>
              <LinearProgress aria-label="Drawing the picture" />
            </Box>
          )}
          {thumb?.status === "failed" && thumb.error && (
            <Alert severity="warning" data-testid="thumbnail-failed">
              The last refresh did not work: {thumb.error}.{picture ? " The previous picture is kept." : ""}
            </Alert>
          )}
          {error && (
            <Alert severity="error" data-testid="thumbnail-error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={refresh}
            disabled={busy || drawing}
            data-testid="thumbnail-refresh"
            sx={{ alignSelf: "flex-start", minHeight: 44 }}
          >
            {picture ? "Refresh picture" : "Draw a picture"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
