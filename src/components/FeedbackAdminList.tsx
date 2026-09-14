"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import DoneIcon from "@mui/icons-material/Done";
import MarkEmailUnreadOutlinedIcon from "@mui/icons-material/MarkEmailUnreadOutlined";
import { explain, portalFetch } from "@/lib/client";
import { relativeTime } from "@/lib/time";
import type { Feedback, FeedbackFilter, FeedbackStatus } from "@/lib/types";

const FILTERS: Array<{ value: FeedbackFilter; label: string }> = [
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "all", label: "All" },
];

interface Props {
  initial: Feedback[];
  filter: FeedbackFilter;
}

/**
 * The admin's view of feedback. The filter is a plain link (the page is
 * server-rendered per filter); only the Mark read / Mark new toggle is done
 * in place, through the portal's PATCH proxy.
 */
export default function FeedbackAdminList({ initial, filter }: Props) {
  const [items, setItems] = useState(initial);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Relative times are computed after mount so the server and client markup agree.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  async function setStatus(item: Feedback, status: FeedbackStatus) {
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await portalFetch<Feedback>(`/api/feedback/${item.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setItems((current) => current.map((f) => (f.id === updated.id ? updated : f)));
    } catch (e) {
      setError(explain(e, "feedback-status"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Stack spacing={2}>
      <ToggleButtonGroup value={filter} exclusive size="small" aria-label="Show" data-testid="feedback-filter">
        {FILTERS.map((f) => (
          <ToggleButton key={f.value} value={f.value} component={Link} href={`/admin/feedback?status=${f.value}`} data-testid={`filter-${f.value}`}>
            {f.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {items.length === 0 ? (
        <Box sx={{ py: 6, textAlign: "center" }} data-testid="feedback-empty">
          <Typography variant="h3" component="p" gutterBottom>
            {filter === "new" ? "Nothing new" : "Nothing here"}
          </Typography>
          <Typography color="text.secondary">
            {filter === "new" ? "Every piece of feedback has been read." : "No feedback matches this filter yet."}
          </Typography>
        </Box>
      ) : (
        items.map((item) => (
          <Card key={item.id} data-testid="feedback-item" data-status={item.status} data-id={item.id}>
            <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Typography variant="h3" component="h2" sx={{ overflowWrap: "anywhere", minWidth: 0 }} data-testid="feedback-username">
                  {item.username}
                </Typography>
                {item.status === "new" && <Chip label="New" color="primary" size="small" />}
                <Typography
                  variant="body2"
                  color="text.secondary"
                  component="time"
                  dateTime={item.created_at}
                  title={new Date(item.created_at).toLocaleString()}
                  data-testid="feedback-when"
                >
                  {now === null ? "" : relativeTime(item.created_at, now)}
                </Typography>
              </Box>
              {item.page && (
                <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }} data-testid="feedback-item-page">
                  On <code>{item.page}</code>
                </Typography>
              )}
              <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }} data-testid="feedback-message">
                {item.message}
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                {item.status === "new" ? (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<DoneIcon />}
                    disabled={busyId === item.id}
                    onClick={() => setStatus(item, "read")}
                    data-testid="mark-read"
                  >
                    Mark read
                  </Button>
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<MarkEmailUnreadOutlinedIcon />}
                    disabled={busyId === item.id}
                    onClick={() => setStatus(item, "new")}
                    data-testid="mark-new"
                  >
                    Mark new
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        ))
      )}
    </Stack>
  );
}
