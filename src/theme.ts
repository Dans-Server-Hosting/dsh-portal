"use client";
import { createTheme } from "@mui/material/styles";

// A restrained palette: one accent, generous spacing, and type sizes that
// still read at 400px. Fonts fall back to the system stack so no web font
// needs to load before the page is usable.
//
// Dark is the default (see lib/color-mode.ts). Both schemes are emitted as
// CSS variables, selected by a `data-dark` / `data-light` attribute on <html>
// that InitColorSchemeScript in the root layout sets before first paint (from
// localStorage, else dark), so a returning visitor who chose light never sees
// a dark flash and vice versa.
const theme = createTheme({
  cssVariables: { colorSchemeSelector: "data" },
  defaultColorScheme: "dark",
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#2e7d32" },
        secondary: { main: "#5d4037" },
        background: { default: "#f6f7f4", paper: "#ffffff" },
      },
    },
    dark: {
      palette: {
        // The same green and brown, two steps lighter so they keep contrast
        // on a near-black ground (Material's guidance for dark surfaces).
        primary: { main: "#66bb6a" },
        secondary: { main: "#bcaaa4" },
        background: { default: "#111412", paper: "#1a1e1b" },
      },
    },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: { fontSize: "clamp(1.9rem, 5vw, 3rem)", fontWeight: 700, lineHeight: 1.15 },
    h2: { fontSize: "clamp(1.4rem, 4vw, 2rem)", fontWeight: 700, lineHeight: 1.2 },
    h3: { fontSize: "clamp(1.15rem, 3vw, 1.5rem)", fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: { defaultProps: { variant: "outlined" } },
  },
});

export default theme;
