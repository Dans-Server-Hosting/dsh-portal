"use client";
import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";

/** The address players paste into Minecraft, with a copy button. */
export default function ServerAddress({ hostname }: { hostname: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(hostname);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be refused; the address is still selectable.
    }
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
      <Typography
        component="code"
        data-testid="server-address"
        sx={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: "0.95rem",
          bgcolor: "action.hover",
          px: 1,
          py: 0.5,
          borderRadius: 1,
          overflowWrap: "anywhere",
          minWidth: 0,
        }}
      >
        {hostname}
      </Typography>
      <Tooltip title={copied ? "Copied" : "Copy address"}>
        <IconButton size="small" onClick={copy} aria-label={copied ? "Copied" : "Copy address"}>
          {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Box>
  );
}
