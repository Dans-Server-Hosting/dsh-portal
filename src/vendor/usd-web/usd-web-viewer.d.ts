// Types for the parts of the vendored usd-web viewer module the portal uses.
import type * as THREE from "three";

export interface UsdWebHook {
  ready: boolean;
  tiles: number;
  revision: number | null;
  errors: string[];
  frames: number;
}

export interface UsdWebViewerOptions {
  THREE: typeof THREE;
  canvas: HTMLCanvasElement;
  /** Directory holding index.json and the tiles; resolved against the page URL. */
  baseUrl?: string;
  /** 0 turns polling for republished tiles off. */
  pollMs?: number;
  /** Name of the window property the viewer reports progress on; null for none. */
  hook?: string | null;
  background?: number;
  panel?: HTMLElement | null;
  labelsHost?: HTMLElement | null;
}

export interface UsdWebViewer {
  ready: Promise<void>;
  render(): void;
  dispose(): void;
}

export function createViewer(options: UsdWebViewerOptions): UsdWebViewer;
