// Shapes of what dsh-api returns. Kept in one place so the pages, the
// route handlers and the mock all agree on the contract.

export type ServerState = "asleep" | "waking" | "awake" | "failed";

export interface Limits {
  heap: string;
  memory_limit: string;
  world_quota: string;
  idle_minutes: number;
  max_awake: number;
  max_registered: number;
  archive_after_days: number;
  backup_retention_days: number;
  minecraft_version: string;
  max_servers_per_tenant: number;
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
