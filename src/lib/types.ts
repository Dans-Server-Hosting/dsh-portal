// Shapes of what dsh-api returns. Kept in one place so the pages, the
// route handlers and the mock all agree on the contract.

export type ServerState = "asleep" | "waking" | "awake" | "failed";

// Exactly what dsh-api's GET /api/v1/limits returns.
export interface Limits {
  servers_per_tenant: number;
  heap_gb: number;
  memory_limit_gib: number;
  world_quota_gib: number;
  idle_minutes: number;
  max_awake_servers: number;
  max_registered_servers: number;
  archive_after_days: number;
  backup_retention_days: number;
  minecraft_version: string;
}

export interface Server {
  name: string;
  hostname: string;
  dashboard_url: string;
  state: ServerState;
  last_woken: string | null;
  players_online: number | null;
  motd: string;
}

/** Returned once, by POST /api/v1/servers, and never again. */
export interface CreatedServer extends Server {
  admin_password?: string;
}

export interface CreateServerRequest {
  name: string;
  motd?: string;
  operator_username?: string;
}

export interface ApiErrorBody {
  message: string;
}

/** Who the token belongs to, from GET /api/v1/me. */
export interface Me {
  username: string;
  is_admin: boolean;
}

export type FeedbackStatus = "new" | "read";
export type FeedbackFilter = FeedbackStatus | "all";

export interface Feedback {
  id: number;
  username: string;
  message: string;
  /** The portal path the user was on when they opened the form, if known. */
  page: string | null;
  created_at: string;
  status: FeedbackStatus;
}

export interface FeedbackRequest {
  message: string;
  page?: string;
}

export const FEEDBACK_MAX_LENGTH = 4000;

export function isFeedbackFilter(value: unknown): value is FeedbackFilter {
  return value === "new" || value === "read" || value === "all";
}

/**
 * Only a path on this portal is worth recording as the page feedback came
 * from: no other origins, no protocol-relative tricks.
 */
export function portalPathOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.length > 200) return null;
  return value;
}

/** Server names as dsh-api validates them (and the UI pre-checks them). */
export const SERVER_NAME_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;
export const SERVER_NAME_FORBIDDEN_SUBSTRING = "omcsi";

export function serverNameProblem(name: string): string | null {
  if (!SERVER_NAME_PATTERN.test(name)) {
    return "Use 2-31 lowercase letters, digits or hyphens, starting with a letter.";
  }
  if (name.includes(SERVER_NAME_FORBIDDEN_SUBSTRING)) {
    return `The name must not contain "${SERVER_NAME_FORBIDDEN_SUBSTRING}".`;
  }
  return null;
}
