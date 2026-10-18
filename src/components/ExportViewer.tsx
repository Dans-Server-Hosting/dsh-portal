"use client";
import { useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import * as THREE from "three";
import { createViewer, type UsdWebViewer } from "@/vendor/usd-web/usd-web-viewer";

/** The window property the viewer reports on; the e2e tests read it. */
export const VIEWER_HOOK = "__dshExportViewer";

/**
 * The usd-web three.js viewer over one export's preview tiles. Loaded with
 * next/dynamic only when Preview is pressed, so three.js stays out of the
 * page's own bundle. The canvas fills its parent; the viewer is created once
 * the parent has a size and disposed when this unmounts.
 */
export default function ExportViewer({ baseUrl }: { baseUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let viewer: UsdWebViewer | null = null;
    let cancelled = false;
    try {
      viewer = createViewer({ THREE, canvas, baseUrl, pollMs: 0, hook: VIEWER_HOOK, background: 0x1b2430 });
      viewer.ready.then(
        () => !cancelled && setState("ready"),
        () => !cancelled && setState("failed"),
      );
    } catch {
      setState("failed");
    }
    // The viewer sizes itself on window resize; the dialog can change size without one.
    const observer = new ResizeObserver(() => window.dispatchEvent(new Event("resize")));
    observer.observe(canvas);
    return () => {
      cancelled = true;
      observer.disconnect();
      viewer?.dispose();
    };
  }, [baseUrl]);

  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%", minHeight: 280 }}>
      <canvas
        ref={canvasRef}
        data-testid="export-viewer-canvas"
        data-state={state}
        aria-label="3D preview of the exported area. Drag to turn it, pinch or scroll to zoom, two fingers or right-drag to move."
        style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
      />
      {state === "loading" && (
        <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <CircularProgress aria-label="Loading the preview" />
        </Box>
      )}
      {state === "failed" && (
        <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", p: 2 }}>
          <Alert severity="error">The preview could not be loaded. The download is not affected.</Alert>
        </Box>
      )}
      {state === "ready" && (
        <Typography
          variant="caption"
          sx={{ position: "absolute", left: 8, bottom: 8, px: 1, py: 0.5, borderRadius: 1, bgcolor: "rgba(0,0,0,0.55)", color: "#fff", pointerEvents: "none" }}
        >
          Drag to turn · pinch or scroll to zoom · two fingers to move
        </Typography>
      )}
    </Box>
  );
}
