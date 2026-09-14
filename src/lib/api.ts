import "server-only";
import { apiBaseUrl } from "./config";
import type { CreatedServer, CreateServerRequest, Feedback, FeedbackFilter, FeedbackRequest, FeedbackStatus, Limits, Me, Server } from "./types";

/** An error response from dsh-api, with the upstream status preserved. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function messageFrom(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body.message === "string") return body.message;
  } catch {
    // fall through
  }
  return response.statusText || `dsh-api returned ${response.status}`;
}

async function call<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("accept", "application/json");
  if (rest.body) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(`${apiBaseUrl()}${path}`, { ...rest, headers, cache: "no-store" });
  if (!response.ok) throw new ApiError(response.status, await messageFrom(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  limits: () => call<Limits>("/api/v1/limits"),
  listServers: (token: string) => call<Server[]>("/api/v1/servers", { token }),
  getServer: (token: string, name: string) => call<Server>(`/api/v1/servers/${encodeURIComponent(name)}`, { token }),
  createServer: (token: string, body: CreateServerRequest) =>
    call<CreatedServer>("/api/v1/servers", { token, method: "POST", body: JSON.stringify(body) }),
  wakeServer: (token: string, name: string) =>
    call<Server>(`/api/v1/servers/${encodeURIComponent(name)}/wake`, { token, method: "POST" }),
  deleteServer: (token: string, name: string, force: boolean) =>
    call<void>(`/api/v1/servers/${encodeURIComponent(name)}${force ? "?force=true" : ""}`, { token, method: "DELETE" }),
  me: (token: string) => call<Me>("/api/v1/me", { token }),
  submitFeedback: (token: string, body: FeedbackRequest) =>
    call<Feedback>("/api/v1/feedback", { token, method: "POST", body: JSON.stringify(body) }),
  listFeedback: (token: string, status: FeedbackFilter) =>
    call<Feedback[]>(`/api/v1/feedback?status=${status}`, { token }),
  setFeedbackStatus: (token: string, id: number, status: FeedbackStatus) =>
    call<Feedback>(`/api/v1/feedback/${id}`, { token, method: "PATCH", body: JSON.stringify({ status }) }),
};
