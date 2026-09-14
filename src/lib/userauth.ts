import "server-only";
import { userAuthUrl } from "./config";

/**
 * The portal's view of UserAuth, which is a plain REST API with no hosted
 * pages. Only server code talks to it, and only these four calls are used.
 */
export class UserAuthError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "UserAuthError";
  }
}

export interface LoginResponse {
  token: string;
  tokenType: string;
  expiresAt: string;
  refreshToken?: string;
}

export interface RegisterResponse {
  id: string | number;
  username: string;
  email: string | null;
  createdAt: string;
}

async function messageFrom(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body.message === "string") return body.message;
  } catch {
    // no JSON body
  }
  return response.statusText || `UserAuth returned ${response.status}`;
}

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("accept", "application/json");
  if (rest.body) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${userAuthUrl()}${path}`, { ...rest, headers, cache: "no-store" });
  if (!response.ok) throw new UserAuthError(response.status, await messageFrom(response));
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const userAuth = {
  login: (username: string, password: string) =>
    call<LoginResponse>("/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  register: (username: string, password: string, email?: string) =>
    call<RegisterResponse>("/register", {
      method: "POST",
      body: JSON.stringify(email ? { username, password, email } : { username, password }),
    }),
  /** Best effort: a failure here must not stop the cookie being cleared. */
  logout: async (token: string): Promise<void> => {
    try {
      await call<unknown>("/logout", { method: "POST", token });
    } catch (error) {
      console.warn("UserAuth logout failed; the cookie is cleared anyway", error);
    }
  },
};
