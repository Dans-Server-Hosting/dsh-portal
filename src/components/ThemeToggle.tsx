"use client";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import { useColorScheme } from "@mui/material/styles";
import { DEFAULT_MODE } from "@/lib/color-mode";

/**
 * Switches between dark and light. MUI keeps the choice in localStorage
 * (`mui-mode`), and InitColorSchemeScript in the root layout applies it
 * before the first paint on the next visit.
 */
export default function ThemeToggle() {
  const { mode, setMode } = useColorScheme();
  // `mode` is undefined on the server and during hydration; assume the
  // default so the button renders the same on both sides.
  const current = mode === "light" || mode === "dark" ? mode : DEFAULT_MODE;
  const next = current === "dark" ? "light" : "dark";
  const label = `Switch to ${next} mode`;
  return (
    <Tooltip title={label}>
      <IconButton
        size="small"
        color="inherit"
        onClick={() => setMode(next)}
        aria-label={label}
        data-testid="theme-toggle"
        data-mode={current}
      >
        {current === "dark" ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}
