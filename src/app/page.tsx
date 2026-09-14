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
import type { Limits } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadLimits(): Promise<Limits | null> {
  try {
    return await api.limits();
  } catch (error) {
    console.error("limits unavailable", error);
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
  const [limits, session] = await Promise.all([loadLimits(), getSession()]);
  const perTenant = limits?.max_servers_per_tenant ?? 1;

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
            <Fact value={`${limits.heap} heap`} label={`${limits.memory_limit} of memory in total`} />
            <Fact value={limits.world_quota} label="of world storage" />
            <Fact value={`${limits.backup_retention_days} days`} label="of backups kept" />
            <Fact value={`${limits.archive_after_days} days`} label="idle before a server is archived" />
          </Grid>
        ) : (
          <Alert severity="warning">The current limits could not be loaded. Try again in a moment.</Alert>
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
            {limits && ` Up to ${limits.max_awake} servers can be awake at once across the whole service, so a wake can occasionally queue.`}
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
