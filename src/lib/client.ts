"use client";

/** Errors from the portal's own route handlers (which mirror dsh-api statuses). */
export class PortalError extends Error {
  constructor(
    public readonly status: number,
    message: string,
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
    const message =
      body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message
        : `Request failed (${response.status})`;
    throw new PortalError(response.status, message);
  }
  return body as T;
}

/** Turns an API failure into a sentence a person can act on. */
export function explain(error: unknown, context: "create" | "delete" | "wake" | "load"): string {
  if (error instanceof PortalError) {
    switch (error.status) {
      case 403:
        return context === "create"
          ? "Your account is at its server limit. Delete a server before creating another."
          : "You do not have permission to do that.";
      case 404:
        return "That server no longer exists.";
      case 409:
        return context === "create"
          ? "That name is already taken. Pick another."
          : context === "delete"
            ? "Players are online right now. Tick the box to delete anyway."
            : error.message;
      case 422:
        return `That name is not allowed: ${error.message}`;
      case 502:
        return "The hosting service is not reachable right now. Try again in a moment.";
      default:
        return error.message;
    }
  }
  return "Something went wrong. Try again in a moment.";
}

export const POLL_INTERVAL_MS = 10_000;
