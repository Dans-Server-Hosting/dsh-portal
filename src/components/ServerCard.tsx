"use client";
import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import MuiLink from "@mui/material/Link";
import type { Server, WorldThumbnail } from "@/lib/types";
import ServerActions from "./ServerActions";
import ServerAddress from "./ServerAddress";
import StatePill from "./StatePill";
import { ThumbnailPicture } from "./WorldThumbnail";

interface Props {
  server: Server;
  onChanged: (server: Server) => void;
  onDeleted: () => void;
  onError: (message: string | null) => void;
  /** The world thumbnail (RFC 0034), when there is one; the card is unchanged without it. */
  thumbnail?: WorldThumbnail | null;
}

export default function ServerCard({ server, onChanged, onDeleted, onError, thumbnail = null }: Props) {
  const picture = thumbnail?.has_picture && thumbnail.rendered_at ? thumbnail.rendered_at : null;
  return (
    <Card data-testid="server-card" data-name={server.name}>
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {picture && (
          <Box
            component={Link}
            href={`/servers/${encodeURIComponent(server.name)}`}
            aria-label={`Open ${server.name}`}
            sx={{ display: "block", alignSelf: { xs: "stretch", sm: "flex-start" } }}
          >
            <ThumbnailPicture server={server.name} renderedAt={picture} />
          </Box>
        )}
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
