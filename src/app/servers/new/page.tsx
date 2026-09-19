import type { Metadata } from "next";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NewServerForm from "@/components/NewServerForm";
import { requireSession } from "@/lib/require-session";
import { api } from "@/lib/api";
import { listPluginNames } from "@/components/DefaultPlugins";

export const metadata: Metadata = { title: "Create a server" };
export const dynamic = "force-dynamic";

export default async function NewServerPage() {
  await requireSession();
  // Best effort: the form works without the list.
  const plugins = await api.defaultPlugins().catch(() => []);
  return (
    <Stack spacing={2}>
      <Typography variant="h1" component="h1">
        Create a server
      </Typography>
      <Typography color="text.secondary">
        Pick a name and you will have an address to share in about a minute. Everything else can be changed later from
        the dashboard.
      </Typography>
      {plugins.length > 0 && (
        <Typography color="text.secondary" data-testid="default-plugins-note">
          It comes with {listPluginNames(plugins)} installed.
        </Typography>
      )}
      <NewServerForm />
    </Stack>
  );
}
