import "server-only";
import { userAuthUrl } from "./config";

/**
 * The portal's view of UserAuth, which is a plain REST API with no hosted
 * pages. Only server code talks to it, and only these calls are used.
 */

/**
 * Where UserAuth's change-password endpoint lives. It is `POST /password` by
 * default; USERAUTH_CHANGE_PASSWORD_PATH overrides it (for example
 * `/password/change`) so the portal need not be rebuilt if the path settles
 * differently. The mock reads the same variable.
 */
export const USERAUTH_CHANGE_PASSWORD_PATH = process.env.USERAUTH_CHANGE_PASSWORD_PATH?.trim() || "/password";
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

export interface ValidateResponse {
  valid: boolean;
  username: string;
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
  /** 200 while the token is live and unrevoked; 401 otherwise. */
  validate: (token: string) => call<ValidateResponse>("/session/validate", { token }),
  /**
   * 204 on success (UserAuth signs every other session of the account out);
   * 401 when `currentPassword` is wrong; 400 with a message when the new
   * password breaks the policy or equals the current one.
   */
  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    call<void>(USERAUTH_CHANGE_PASSWORD_PATH, { method: "POST", token, body: JSON.stringify({ currentPassword, newPassword }) }),
  /** Best effort: a failure here must not stop the cookie being cleared. */
  logout: async (token: string): Promise<void> => {
    try {
      await call<unknown>("/logout", { method: "POST", token });
    } catch (error) {
      console.warn("UserAuth logout failed; the cookie is cleared anyway", error);
    }
  },
};
