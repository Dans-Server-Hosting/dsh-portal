import Chip from "@mui/material/Chip";
import type { ServerState } from "@/lib/types";

const LOOK: Record<ServerState, { label: string; color: "default" | "warning" | "success" | "error"; hint: string }> = {
  asleep: { label: "asleep", color: "default", hint: "Wakes when a player joins or Wake is pressed" },
  waking: { label: "waking", color: "warning", hint: "Starting up; usually under a minute" },
  awake: { label: "awake", color: "success", hint: "Running and joinable now" },
  failed: { label: "failed", color: "error", hint: "Did not start; try Wake again or check the dashboard" },
};

export default function StatePill({ state, size = "medium" }: { state: ServerState; size?: "small" | "medium" }) {
  const look = LOOK[state] ?? { label: state, color: "default" as const, hint: "" };
  return (
    <Chip
      label={look.label}
      color={look.color}
      size={size}
      variant={state === "asleep" ? "outlined" : "filled"}
      title={look.hint}
      data-testid="state-pill"
      data-state={state}
      sx={{ fontWeight: 600, textTransform: "capitalize" }}
    />
  );
}
