"use client";
import { createTheme } from "@mui/material/styles";

// A restrained palette: one accent, generous spacing, and type sizes that
// still read at 400px. Fonts fall back to the system stack so no web font
// needs to load before the page is usable.
const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: "light",
    primary: { main: "#2e7d32" },
    secondary: { main: "#5d4037" },
    background: { default: "#f6f7f4", paper: "#ffffff" },
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
