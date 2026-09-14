"use client";
import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import MuiLink from "@mui/material/Link";
import type { Server } from "@/lib/types";
import ServerActions from "./ServerActions";
import ServerAddress from "./ServerAddress";
import StatePill from "./StatePill";

interface Props {
  server: Server;
  onChanged: (server: Server) => void;
  onDeleted: () => void;
  onError: (message: string | null) => void;
}

export default function ServerCard({ server, onChanged, onDeleted, onError }: Props) {
  return (
    <Card data-testid="server-card" data-name={server.name}>
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="h3" component="h2" sx={{ overflowWrap: "anywhere", minWidth: 0 }}>
            <MuiLink component={Link} href={`/servers/${encodeURIComponent(server.name)}`} underline="hover" color="inherit">
              {server.name}
            </MuiLink>
          </Typography>
          <StatePill state={server.state} size="small" />
          {server.state === "awake" && server.players_online !== null && (
            <Typography variant="body2" color="text.secondary">
              {server.players_online} online
            </Typography>
          )}
        </Box>
        {server.motd && (
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            {server.motd}
          </Typography>
        )}
        <ServerAddress hostname={server.hostname} />
        <ServerActions server={server} onChanged={onChanged} onDeleted={onDeleted} onError={onError} />
      </CardContent>
    </Card>
  );
}
