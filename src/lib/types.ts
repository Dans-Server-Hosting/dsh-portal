// Shapes of what dsh-api returns. Kept in one place so the pages, the
// route handlers and the mock all agree on the contract.

// `provisioning` is what POST /api/v1/servers answers with (202) while the
// server is being set up; `stopped` is a game process that exited while its
// pod stayed up (Stop in the dashboard, or a crash), which Wake starts again.
export type ServerState = "provisioning" | "asleep" | "waking" | "awake" | "stopped" | "failed";

/** States in which Wake does something (dsh-api treats the rest as a no-op). */
export const WAKEABLE_STATES: readonly ServerState[] = ["asleep", "stopped", "failed"];

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
  // World export (RFC 0021); present whether or not the feature is switched on.
  export_default_size?: number;
  export_max_size?: number;
  export_daily_limit?: number;
  export_retention_hours?: number;
}

// Exactly what dsh-api's GET /api/v1/default-plugins returns: the plugins
// every new server is installed with, in install order. `description` is
// empty and `project_url` null for a plugin the API does not know.
export interface DefaultPlugin {
  name: string;
  version: string;
  description: string;
  download_url: string;
  project_url: string | null;
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

/**
 * Returned once, by POST /api/v1/servers (202, state `provisioning`), and
 * never again: the password is not stored anywhere the portal can read.
 */
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
  /**
   * On a 409 from POST /api/v1/servers while another create is still
   * provisioning: the name of the server being created.
   */
  server?: string;
  /** On a 409 from POST .../plugins/apply: how many players a restart would disconnect. */
  players_online?: number;
  /** On a 429 from POST .../exports: seconds until another export is allowed. */
  retry_after?: number;
}

// ---- World export as 3D (RFC 0021) ----

export type ExportStatus = "queued" | "running" | "ready" | "failed";
export type ExportPhase = "starting" | "copying" | "exporting" | "preview" | "packaging";
/**
 * `at_rest`: copied while the server was asleep (exact). `live_stable`: copied
 * while it ran, and nothing changed during the copy. `live_changing`: it kept
 * saving during the copy, so a few chunks may be missing or out of date.
 */
export type ExportSnapshot = "at_rest" | "live_stable" | "live_changing";

/** An X/Z box in block coordinates, corners inclusive; every height is exported. */
export interface ExportArea {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface ExportStats {
  blocks_scanned: number;
  instances: number;
  zip_bytes: number;
  preview_bytes: number;
}

export interface WorldExport {
  id: string;
  server: string;
  status: ExportStatus;
  phase: ExportPhase | null;
  /** null until the box around spawn has been worked out. */
  area: ExportArea | null;
  custom_area: boolean;
  snapshot: ExportSnapshot | null;
  created_at: string;
  finished_at: string | null;
  expires_at: string | null;
  error: string | null;
  stats: ExportStats | null;
}

/** GET /api/v1/servers/{name}/exports, newest first. */
export interface WorldExportList {
  exports: WorldExport[];
}

/** POST .../exports/{id}/link: a signed download URL that needs no session. */
export interface ExportLink {
  url: string;
  expires_at: string;
}

/** The usd-web files an export's preview is made of. */
export const PREVIEW_FILE_PATTERN = /^(index\.json|t\.-?\d+\.-?\d+\.[0-9a-f]+\.uwt)$/;

// ---- Plugin selection (RFC 0020) ----

// Exactly what dsh-api's GET /api/v1/catalog returns, one per installable
// plugin, sorted by title. `requires` are slugs installed alongside it.
export interface CatalogPlugin {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  requires: string[];
  version: string;
  icon_url: string | null;
  project_url: string | null;
}

/**
 * `installed`: on disk since the last start. `pending`: waits for the next
 * start. `failed…`: the last start could not install it (the text says why).
 */
export type PluginStatus = "installed" | "pending" | string;

export interface ServerPlugin {
  slug: string;
  title: string;
  version: string;
  /** "default" (came with the server), "tenant" (chosen) or "dependency" (installed for another plugin). */
  added_by: "default" | "tenant" | "dependency" | string;
  requires: string[];
  /** Selected plugins that need this one; while any do, it cannot be removed. */
  required_by: string[];
  status: PluginStatus;
}

// GET /api/v1/servers/{name}/plugins. `pending` is true while the selection
// differs from what the server last started with.
export interface ServerPlugins {
  server: string;
  state: ServerState;
  players_online: number | null;
  pending: boolean;
  plugins: ServerPlugin[];
}

/** PUT .../plugins/{slug}: everything newly selected, the plugin first. */
export interface AddedPlugins extends ServerPlugins {
  added: string[];
}

/** DELETE .../plugins/{slug}: dependencies nothing needs any more, offered for removal. */
export interface RemovedPlugin extends ServerPlugins {
  removed: string;
  unused_dependencies: string[];
}

/** POST .../plugins/apply (202). */
export interface ApplyResult {
  applies: "next_start" | "restarting";
}

/** What the portal accepts from its own change-password form. */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
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
