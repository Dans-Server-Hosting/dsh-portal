import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { DefaultPlugin } from "@/lib/types";

// The plugins every new server is installed with, as dsh-api describes them.
// No hooks, no server-only imports: both the server-rendered landing page
// and the client-side ServerDetail render these.

/** "A, B and C" */
export function listPluginNames(plugins: DefaultPlugin[]): string {
  const names = plugins.map((p) => p.name);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function PluginName({ plugin }: { plugin: DefaultPlugin }) {
  return plugin.project_url ? (
    <Link href={plugin.project_url} target="_blank" rel="noopener noreferrer" underline="hover" color="inherit">
      {plugin.name}
    </Link>
  ) : (
    <>{plugin.name}</>
  );
}

/** One card per plugin; the landing page's "what comes installed". */
export function DefaultPluginCards({ plugins }: { plugins: DefaultPlugin[] }) {
  return (
    <Grid container spacing={2} data-testid="default-plugins">
      {plugins.map((plugin) => (
        <Grid key={plugin.download_url} size={{ xs: 12, sm: 6, md: 4 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                <Typography variant="h6" component="h3" sx={{ overflowWrap: "anywhere" }}>
                  <PluginName plugin={plugin} />
                </Typography>
                {plugin.version && <Chip label={plugin.version} size="small" variant="outlined" sx={{ fontFamily: "monospace" }} />}
              </Box>
              {plugin.description && (
                <Typography variant="body2" color="text.secondary">
                  {plugin.description}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

/** A compact list; the server page's "installed by default". */
export function DefaultPluginList({ plugins }: { plugins: DefaultPlugin[] }) {
  return (
    <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", p: 0, m: 0 }} data-testid="default-plugins">
      {plugins.map((plugin) => (
        <Box component="li" key={plugin.download_url} sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            <PluginName plugin={plugin} />
          </Typography>
          {plugin.version && (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
              {plugin.version}
            </Typography>
          )}
          {plugin.description && (
            <Typography variant="body2" color="text.secondary">
              {plugin.description}
            </Typography>
          )}
        </Box>
      ))}
    </Stack>
  );
}
