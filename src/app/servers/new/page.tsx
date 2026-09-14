import type { Metadata } from "next";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NewServerForm from "@/components/NewServerForm";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = { title: "Create a server" };
export const dynamic = "force-dynamic";

export default async function NewServerPage() {
  await requireSession();
  return (
    <Stack spacing={2}>
      <Typography variant="h1" component="h1">
        Create a server
      </Typography>
      <Typography color="text.secondary">
        Pick a name and you will have an address to share in about a minute. Everything else can be changed later from
        the dashboard.
      </Typography>
      <NewServerForm />
    </Stack>
  );
}
