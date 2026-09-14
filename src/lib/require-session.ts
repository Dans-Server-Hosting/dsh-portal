import "server-only";
import { redirect } from "next/navigation";
import { getSession, type Session } from "./session";

/** Server components call this: no cookie means straight to sign-in. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  return session;
}
