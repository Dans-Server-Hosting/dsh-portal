"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Button from "@mui/material/Button";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";

/**
 * The header's Feedback link. It is a client component only so it can read
 * the current path and hand it to the form as `from`, which the API stores
 * as the page the feedback is about.
 */
export default function FeedbackLink() {
  const pathname = usePathname();
  const href = pathname && pathname !== "/feedback" ? `/feedback?from=${encodeURIComponent(pathname)}` : "/feedback";
  return (
    <Button component={Link} href={href} size="small" color="inherit" startIcon={<ChatBubbleOutlineIcon />} data-testid="feedback-link">
      Feedback
    </Button>
  );
}
