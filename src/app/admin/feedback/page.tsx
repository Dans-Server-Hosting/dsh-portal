import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import FeedbackAdminList from "@/components/FeedbackAdminList";
import { api, ApiError } from "@/lib/api";
import { getMe } from "@/lib/me";
import { requireSession } from "@/lib/require-session";
import { isFeedbackFilter, type Feedback, type FeedbackFilter } from "@/lib/types";

export const metadata: Metadata = { title: "Feedback · Admin" };
export const dynamic = "force-dynamic";

/**
 * Admin only. Anyone else gets the same "not found" page as a route that does
 * not exist, so the address reveals nothing. The API enforces this too: the
 * check here only decides what to render.
 */
export default async function AdminFeedbackPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await requireSession();
  const me = await getMe(session.token);
  if (!me?.is_admin) notFound();

  const params = await searchParams;
  const filter: FeedbackFilter = isFeedbackFilter(params.status) ? params.status : "new";

  let items: Feedback[] = [];
  let loadError: string | null = null;
  try {
    items = await api.listFeedback(session.token, filter);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) notFound();
    loadError = error instanceof ApiError ? error.message : "The hosting service is not reachable right now.";
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h1" component="h1">
        Feedback
      </Typography>
      <Typography color="text.secondary">
        What signed-in users have sent from the Feedback link, newest first. Mark an item read once someone has looked at
        it; it can be marked new again.
      </Typography>
      {loadError && <Alert severity="error">Feedback could not be loaded: {loadError}</Alert>}
      <FeedbackAdminList key={filter} initial={items} filter={filter} />
    </Stack>
  );
}
