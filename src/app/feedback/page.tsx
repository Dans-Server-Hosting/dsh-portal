import type { Metadata } from "next";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import FeedbackForm from "@/components/FeedbackForm";
import { requireSession } from "@/lib/require-session";
import { portalPathOrNull } from "@/lib/types";

export const metadata: Metadata = { title: "Feedback" };
export const dynamic = "force-dynamic";

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  await requireSession();
  const params = await searchParams;
  const page = portalPathOrNull(params.from);
  return (
    <Stack spacing={2} sx={{ maxWidth: 640 }}>
      <Typography variant="h1" component="h1">
        Feedback
      </Typography>
      <Typography color="text.secondary">
        Something confusing, broken, or missing? Say so here and it goes straight to the people running the service.
      </Typography>
      <FeedbackForm page={page} />
    </Stack>
  );
}
