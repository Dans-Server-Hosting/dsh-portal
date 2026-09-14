"use client";
import { useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { explain, portalFetch } from "@/lib/client";
import { FEEDBACK_MAX_LENGTH, type Feedback, type FeedbackRequest } from "@/lib/types";

/** A textarea with a counter; the page it came from is sent along invisibly. */
export default function FeedbackForm({ page }: { page: string | null }) {
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Feedback | null>(null);

  const trimmed = message.trim();
  const problem = !trimmed
    ? "Write something first."
    : trimmed.length > FEEDBACK_MAX_LENGTH
      ? `Keep it to ${FEEDBACK_MAX_LENGTH} characters.`
      : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (problem) return;
    setBusy(true);
    setError(null);
    const body: FeedbackRequest = { message: trimmed };
    if (page) body.page = page;
    try {
      setSent(await portalFetch<Feedback>("/api/feedback", { method: "POST", body: JSON.stringify(body) }));
    } catch (e) {
      setError(explain(e, "feedback"));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Stack spacing={2} data-testid="feedback-sent">
        <Alert severity="success">
          <AlertTitle>Thank you</AlertTitle>
          Your feedback was received and will be read by a person. Nothing else is needed from you.
        </Alert>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button component={Link} href={page ?? "/servers"} variant="contained" data-testid="feedback-back">
            {page ? "Back to where you were" : "My servers"}
          </Button>
          <Button
            onClick={() => {
              setSent(null);
              setMessage("");
              setTouched(false);
            }}
          >
            Send more
          </Button>
        </Stack>
      </Stack>
    );
  }

  return (
    <Box component="form" onSubmit={submit} noValidate>
      <Stack spacing={2.5}>
        <TextField
          label="Your feedback"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onBlur={() => setTouched(true)}
          required
          fullWidth
          multiline
          minRows={6}
          autoFocus
          error={touched && !!problem}
          helperText={
            <Box component="span" sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
              <span>{touched && problem ? problem : "Plain text. No account details are needed; the team can see who sent it."}</span>
              <Typography component="span" variant="caption" data-testid="feedback-counter" sx={{ whiteSpace: "nowrap" }}>
                {message.length} / {FEEDBACK_MAX_LENGTH}
              </Typography>
            </Box>
          }
          inputProps={{ "data-testid": "feedback-input", maxLength: FEEDBACK_MAX_LENGTH }}
          disabled={busy}
        />
        {page && (
          <Typography variant="body2" color="text.secondary" data-testid="feedback-page">
            About the page <code>{page}</code>.
          </Typography>
        )}
        {error && (
          <Alert severity="error" data-testid="feedback-error">
            {error}
          </Alert>
        )}
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button type="submit" variant="contained" disabled={busy} data-testid="feedback-submit">
            {busy ? "Sending…" : "Send feedback"}
          </Button>
          <Button component={Link} href={page ?? "/servers"} disabled={busy}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
