"use client";
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import { PortalError, portalFetch } from "@/lib/client";

/**
 * Stands in for a server-rendered page whose API call answered 401. A server
 * component cannot clear the cookie, and the sign-in page sends anyone with a
 * cookie back here, so one call to a proxy does both: `withSession` clears the
 * cookie and `portalFetch` goes to sign-in. Any other answer leaves the session
 * unsettled, which is said rather than waited on.
 */
export default function SessionExpired() {
  const [unconfirmed, setUnconfirmed] = useState(false);

  useEffect(() => {
    portalFetch("/api/servers").then(
      () => setUnconfirmed(true),
      (error) => {
        if (!(error instanceof PortalError && error.status === 401)) setUnconfirmed(true);
      },
    );
  }, []);

  if (unconfirmed) {
    return (
      <Alert severity="error" data-testid="session-unconfirmed">
        Your session could not be checked. Reload the page to try again.
      </Alert>
    );
  }
  return (
    <Alert severity="info" data-testid="session-expired">
      Your session has expired; signing you in again.
    </Alert>
  );
}
