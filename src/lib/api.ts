import "server-only";
import { apiBaseUrl } from "./config";
import type {
  AddedPlugins,
  ApplyResult,
  CatalogPlugin,
  CreatedServer,
  CreateServerRequest,
  DefaultPlugin,
  Feedback,
  FeedbackFilter,
  FeedbackRequest,
  FeedbackStatus,
  Limits,
  Me,
  RemovedPlugin,
  Server,
  ServerPlugins,
} from "./types";

/** What the user is told when dsh-api gave no answer; a 502 with a detail is not that. */
export const NOT_REACHABLE = "The hosting service is not reachable right now. Try again in a moment.";

/**
 * An error response from dsh-api, with the upstream status preserved. The
 * body's `detail` (FastAPI's key) or `message` becomes the message; a
 * `server` field, which the create endpoint adds to its "already being
 * created" 409, is carried along so the client can link to that server.
 * A 502 from dsh-api itself carries a detail that is safe to show (its
 * ClusterError handler); a gateway answer with no JSON body — an ingress
 * standing in for an API that is down — is reported as "not reachable".
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly server?: string,
    /** Set on the plugin apply endpoint's 409: the players a restart would disconnect. */
    public readonly playersOnline?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const GATEWAY_STATUSES = [502, 503, 504];

async function errorFrom(response: Response): Promise<ApiError> {
  let message: string | undefined;
  let server: string | undefined;
  let playersOnline: number | undefined;
  try {
    const body = await response.json();
    if (body && typeof body.detail === "string") message = body.detail;
    else if (body && typeof body.message === "string") message = body.message;
    if (body && typeof body.server === "string") server = body.server;
    if (body && typeof body.players_online === "number") playersOnline = body.players_online;
  } catch {
    // no JSON body
  }
  if (message === undefined) {
    message = GATEWAY_STATUSES.includes(response.status)
      ? NOT_REACHABLE
      : response.statusText || `dsh-api returned ${response.status}`;
  }
  return new ApiError(response.status, message, server, playersOnline);
}

async function call<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("accept", "application/json");
  if (rest.body) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(`${apiBaseUrl()}${path}`, { ...rest, headers, cache: "no-store" });
  if (!response.ok) throw await errorFrom(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  limits: () => call<Limits>("/api/v1/limits"),
  defaultPlugins: () => call<DefaultPlugin[]>("/api/v1/default-plugins"),
  listServers: (token: string) => call<Server[]>("/api/v1/servers", { token }),
  getServer: (token: string, name: string) => call<Server>(`/api/v1/servers/${encodeURIComponent(name)}`, { token }),
  /** 202 with the server in state `provisioning`; GET reports the progress from there. */
  createServer: (token: string, body: CreateServerRequest) =>
    call<CreatedServer>("/api/v1/servers", { token, method: "POST", body: JSON.stringify(body) }),
  wakeServer: (token: string, name: string) =>
    call<Server>(`/api/v1/servers/${encodeURIComponent(name)}/wake`, { token, method: "POST" }),
  deleteServer: (token: string, name: string, force: boolean) =>
    call<void>(`/api/v1/servers/${encodeURIComponent(name)}${force ? "?force=true" : ""}`, { token, method: "DELETE" }),
  catalog: () => call<CatalogPlugin[]>("/api/v1/catalog"),
  serverPlugins: (token: string, name: string) =>
    call<ServerPlugins>(`/api/v1/servers/${encodeURIComponent(name)}/plugins`, { token }),
  addPlugin: (token: string, name: string, slug: string) =>
    call<AddedPlugins>(`/api/v1/servers/${encodeURIComponent(name)}/plugins/${encodeURIComponent(slug)}`, {
      token,
      method: "PUT",
    }),
  removePlugin: (token: string, name: string, slug: string) =>
    call<RemovedPlugin>(`/api/v1/servers/${encodeURIComponent(name)}/plugins/${encodeURIComponent(slug)}`, {
      token,
      method: "DELETE",
    }),
  /** 202; a 409 with `players_online` means it needs `confirmPlayers`. */
  applyPlugins: (token: string, name: string, confirmPlayers: boolean) =>
    call<ApplyResult>(`/api/v1/servers/${encodeURIComponent(name)}/plugins/apply`, {
      token,
      method: "POST",
      body: JSON.stringify({ confirm_players: confirmPlayers }),
    }),
  me: (token: string) => call<Me>("/api/v1/me", { token }),
  submitFeedback: (token: string, body: FeedbackRequest) =>
    call<Feedback>("/api/v1/feedback", { token, method: "POST", body: JSON.stringify(body) }),
  listFeedback: (token: string, status: FeedbackFilter) =>
    call<Feedback[]>(`/api/v1/feedback?status=${status}`, { token }),
  setFeedbackStatus: (token: string, id: number, status: FeedbackStatus) =>
    call<Feedback>(`/api/v1/feedback/${id}`, { token, method: "PATCH", body: JSON.stringify({ status }) }),
};
