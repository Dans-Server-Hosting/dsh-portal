import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { api } from "@/lib/api";
import { getSession } from "@/lib/session";
import type { DefaultPlugin, Limits } from "@/lib/types";
import { DefaultPluginCards } from "@/components/DefaultPlugins";

export const dynamic = "force-dynamic";

async function loadLimits(): Promise<Limits | null> {
  try {
    return await api.limits();
  } catch (error) {
    console.error("limits unavailable", error);
    return null;
  }
}

async function loadDefaultPlugins(): Promise<DefaultPlugin[] | null> {
  try {
    return await api.defaultPlugins();
  } catch (error) {
    console.error("default plugins unavailable", error);
    return null;
  }
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <Grid size={{ xs: 6, sm: 4 }}>
      <Card sx={{ height: "100%" }}>
        <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
          <Typography variant="h3" component="p" sx={{ overflowWrap: "anywhere" }}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  );
}

export default async function LandingPage() {
  const [limits, plugins, session] = await Promise.all([loadLimits(), loadDefaultPlugins(), getSession()]);
  const perTenant = limits?.servers_per_tenant ?? 1;

  return (
    <Stack spacing={5}>
      <Box>
        <Typography variant="h1" component="h1" gutterBottom>
          A free Minecraft server for you and your friends.
        </Typography>
        <Typography variant="h6" component="p" color="text.secondary" sx={{ fontWeight: 400, mb: 3 }}>
          Sign in, press <strong>Create server</strong>, and you have an address to hand out. It sleeps when nobody is
          playing and wakes when someone joins.
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          {session ? (
            <Button component={Link} href="/servers" variant="contained" size="large">
              Go to my servers
            </Button>
          ) : (
            <>
              <Button component={Link} href="/auth/login" variant="contained" size="large" data-testid="sign-in">
                Sign in
              </Button>
              <Button component={Link} href="/auth/register" variant="outlined" size="large" data-testid="create-account">
                Create account
              </Button>
            </>
          )}
        </Stack>
      </Box>

      <Box component="section" aria-labelledby="tier-heading">
        <Typography variant="h2" component="h2" id="tier-heading" gutterBottom>
          What the free tier is
        </Typography>
        {limits ? (
          <Grid container spacing={2} data-testid="limits">
            <Fact value={`Minecraft ${limits.minecraft_version}`} label="Java Edition, current version" />
            <Fact value={`${perTenant} server`} label="per account" />
            <Fact value={`${limits.heap_gb} GB heap`} label={`${limits.memory_limit_gib} GiB of memory in total`} />
            <Fact value={`${limits.world_quota_gib} GB`} label="of world storage" />
            <Fact value={`${limits.backup_retention_days} days`} label="of backups kept" />
            <Fact value={`${limits.archive_after_days} days`} label="idle before a server is archived" />
          </Grid>
        ) : (
          <Alert severity="warning">The current limits could not be loaded. Try again in a moment.</Alert>
        )}
      </Box>

      <Box component="section" aria-labelledby="plugins-heading">
        <Typography variant="h2" component="h2" id="plugins-heading" gutterBottom>
          What comes installed
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Every new server starts with these plugins. Anything else is yours to add from the dashboard.
        </Typography>
        {plugins && plugins.length > 0 ? (
          <DefaultPluginCards plugins={plugins} />
        ) : plugins ? (
          <Typography color="text.secondary">A plain Minecraft server, with no plugins preinstalled.</Typography>
        ) : (
          <Alert severity="warning">The list of preinstalled plugins could not be loaded. Try again in a moment.</Alert>
        )}
      </Box>

      <Box component="section" aria-labelledby="sleep-heading">
        <Typography variant="h2" component="h2" id="sleep-heading" gutterBottom>
          How sleeping works
        </Typography>
        <Stack spacing={1.5} component="ol" sx={{ pl: 3, m: 0 }}>
          <Typography component="li">
            Your server starts <strong>asleep</strong>. It costs nothing while it sleeps and keeps its world.
          </Typography>
          <Typography component="li">
            When a player connects to the address, the server <strong>wakes</strong>: it is usually joinable in under a
            minute. You can also press <strong>Wake</strong> in the portal.
          </Typography>
          <Typography component="li">
            After {limits ? `${limits.idle_minutes} minutes` : "a while"} with nobody online it goes back to sleep.
            {limits && ` Up to ${limits.max_awake_servers} servers can be awake at once across the whole service, so a wake can occasionally queue.`}
          </Typography>
          <Typography component="li">
            A server nobody has woken for {limits ? `${limits.archive_after_days} days` : "a long time"} is archived;
            deleting one always takes a backup first.
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
}
