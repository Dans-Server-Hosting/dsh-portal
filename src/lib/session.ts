import "server-only";
import { cookies } from "next/headers";
import { secureCookies } from "./config";

export const SESSION_COOKIE = "dsh_session";
const ONE_DAY_SECONDS = 60 * 60 * 24;

export interface Session {
  /** The raw UserAuth JWT. Never leaves the server. */
  token: string;
  /** Display-only: the `sub` claim, if the token can be decoded. */
  username: string | null;
}

/** Decodes the JWT payload for display purposes only; dsh-api verifies it. */
function decodeSubject(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

function tokenExpiry(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return { token, username: decodeSubject(token) };
}

/** Cookie lifetime follows UserAuth's `expiresAt`, falling back to the JWT's `exp`. */
export function sessionCookieOptions(token: string, expiresAt?: string) {
  const fromResponse = expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : NaN;
  const exp = Number.isFinite(fromResponse) ? fromResponse : tokenExpiry(token);
  const maxAge = exp ? Math.max(0, exp - Math.floor(Date.now() / 1000)) : ONE_DAY_SECONDS;
  return {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function clearedSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
