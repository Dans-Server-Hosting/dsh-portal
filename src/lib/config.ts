import "server-only";

// Every value here is read on the server. None of them is ever shipped to
// the browser, and the portal holds no cluster credentials of any kind.

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function apiBaseUrl(): string {
  const value = process.env.DSH_API_URL;
  if (!value) throw new Error("DSH_API_URL is not set");
  return trimSlash(value);
}

export function userAuthUrl(): string {
  const value = process.env.USERAUTH_URL;
  if (!value) throw new Error("USERAUTH_URL is not set");
  return trimSlash(value);
}

/**
 * Where UserAuth's change-password endpoint lives under USERAUTH_URL. It is
 * `POST /password` by default; USERAUTH_CHANGE_PASSWORD_PATH overrides it
 * (for example `/password/change`) so the portal need not be rebuilt if the
 * path settles differently. A value written without its leading slash gets
 * one, as it is appended to USERAUTH_URL as is. The mock reads the same
 * variable the same way.
 */
export function userAuthChangePasswordPath(): string {
  const value = process.env.USERAUTH_CHANGE_PASSWORD_PATH?.trim() || "/password";
  return value.startsWith("/") ? value : `/${value}`;
}

/** The portal's own public origin, used for redirects after sign-out. */
export function portalUrl(requestOrigin: string): string {
  return trimSlash(process.env.PORTAL_URL || requestOrigin);
}

export function secureCookies(): boolean {
  const explicit = process.env.DSH_SECURE_COOKIE;
  if (explicit !== undefined) return explicit !== "0";
  return process.env.NODE_ENV === "production";
}
