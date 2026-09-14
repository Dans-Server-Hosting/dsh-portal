"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { passwordProblem, usernameProblem } from "@/lib/credentials";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { userAuth, UserAuthError } from "@/lib/userauth";

export interface AuthFormState {
  error: string | null;
}

function field(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

async function startSession(username: string, password: string): Promise<void> {
  const login = await userAuth.login(username, password);
  const store = await cookies();
  store.set(SESSION_COOKIE, login.token, sessionCookieOptions(login.token, login.expiresAt));
}

function explainLogin(error: unknown): string {
  if (error instanceof UserAuthError) {
    if (error.status === 401) return "That username and password do not match.";
    if (error.status === 400) return error.message;
    if (error.status >= 500) return "Sign-in is not available right now. Try again in a moment.";
    return error.message;
  }
  return "Sign-in is not available right now. Try again in a moment.";
}

export async function loginAction(_prev: AuthFormState, data: FormData): Promise<AuthFormState> {
  const username = field(data, "username").trim();
  const password = field(data, "password");
  if (!username || !password) return { error: "Enter your username and password." };
  try {
    await startSession(username, password);
  } catch (error) {
    return { error: explainLogin(error) };
  }
  redirect("/servers");
}

export async function registerAction(_prev: AuthFormState, data: FormData): Promise<AuthFormState> {
  const username = field(data, "username").trim();
  const password = field(data, "password");
  const email = field(data, "email").trim();
  const problem = usernameProblem(username) ?? passwordProblem(password);
  if (problem) return { error: problem };
  try {
    await userAuth.register(username, password, email || undefined);
  } catch (error) {
    if (error instanceof UserAuthError) {
      if (error.status === 409) return { error: "That username or email is already taken." };
      if (error.status === 400) return { error: error.message };
    }
    return { error: "Registration is not available right now. Try again in a moment." };
  }
  try {
    await startSession(username, password);
  } catch {
    // The account exists; the user can sign in by hand.
    redirect("/auth/login?registered=1");
  }
  redirect("/servers");
}
