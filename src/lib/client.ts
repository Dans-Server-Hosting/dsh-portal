"use client";

/** Errors from the portal's own route handlers (which mirror dsh-api statuses). */
export class PortalError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Set on the create endpoint's 409 when another create is still in progress. */
    public readonly server?: string,
  ) {
    super(message);
    this.name = "PortalError";
  }
}

/**
 * Talks to the portal's /api/servers* handlers. No token is involved here:
 * the browser only carries the httpOnly cookie, and the server side adds the
 * Bearer header. A 401 means the session is gone, so the user is sent back
 * through sign-in.
 */
export async function portalFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers, cache: "no-store", credentials: "same-origin" });

  if (response.status === 401) {
    window.location.assign("/auth/login");
    throw new PortalError(401, "Your session has expired; signing you in again.");
  }
  if (response.status === 204) return undefined as T;

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // no body
  }
  if (!response.ok) {
    const fields = body && typeof body === "object" ? (body as { message?: unknown; server?: unknown }) : {};
    const message = typeof fields.message === "string" ? fields.message : `Request failed (${response.status})`;
    throw new PortalError(response.status, message, typeof fields.server === "string" ? fields.server : undefined);
  }
  return body as T;
}

/** Turns an API failure into a sentence a person can act on. */
export function explain(
  error: unknown,
  context: "create" | "delete" | "wake" | "load" | "feedback" | "feedback-status" | "password",
): string {
  if (error instanceof PortalError) {
    switch (error.status) {
      case 400:
        return error.message;
      case 403:
        return context === "create"
          ? "Your account is at its server limit. Delete a server before creating another."
          : context === "password"
            ? "That is not your current password."
            : "You do not have permission to do that.";
      case 404:
        return context === "feedback-status" ? "That feedback no longer exists." : "That server no longer exists.";
      case 409:
        return context === "create"
          ? error.server
            ? "A server is already being created for your account."
            : "That name is already taken. Pick another."
          : context === "delete"
            ? "Players are online right now. Tick the box to delete anyway."
            : error.message;
      case 422:
        return context === "feedback" ? `That could not be sent: ${error.message}` : `That name is not allowed: ${error.message}`;
      case 429:
        return "You have sent a lot of feedback in the last hour. Thank you; please try again later.";
      default:
        // A 502 carries a sentence that is meant to be shown: dsh-api's own
        // detail when a cluster operation failed (retrying would fail the
        // same way), or the route handler's "not reachable" when the fetch
        // never got a response.
        return error.message;
    }
  }
  return "Something went wrong. Try again in a moment.";
}

export const POLL_INTERVAL_MS = 10_000;
/** A server that was just created is watched more closely than the list. */
export const CREATE_POLL_INTERVAL_MS = 5_000;
