import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { newPasswordProblem } from "@/lib/credentials";
import { getSession } from "@/lib/session";
import type { ChangePasswordRequest } from "@/lib/types";
import { userAuth, UserAuthError } from "@/lib/userauth";

export const dynamic = "force-dynamic";

/**
 * Forwards the account page's change-password form to UserAuth with the
 * session's token. UserAuth's 400 (policy) and its 401 (wrong current
 * password) are shown plainly by the form; the latter is answered here as a
 * 403 so the browser does not mistake it for an expired session, which is
 * what a 401 from the portal's own handlers means. A token that really has
 * expired is told apart by asking UserAuth whether it is still valid.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "You are not signed in." }, { status: 401 });

  let body: Partial<ChangePasswordRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "The request body must be JSON." }, { status: 400 });
  }
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (!currentPassword) return NextResponse.json({ message: "Enter your current password." }, { status: 400 });
  const problem = newPasswordProblem(currentPassword, newPassword);
  if (problem) return NextResponse.json({ message: problem }, { status: 400 });

  try {
    await userAuth.changePassword(session.token, currentPassword, newPassword);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof UserAuthError) {
      if (error.status === 400) return NextResponse.json({ message: error.message }, { status: 400 });
      if (error.status === 401) {
        const sessionAlive = await userAuth
          .validate(session.token)
          .then(() => true)
          .catch((e) => !(e instanceof UserAuthError && e.status === 401));
        if (!sessionAlive) return NextResponse.json({ message: "Your session has expired." }, { status: 401 });
        return NextResponse.json({ message: "That is not your current password." }, { status: 403 });
      }
      if (error.status < 500) return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("change password failed", error);
    // Shown as is by the form, so it is the whole sentence.
    return NextResponse.json({ message: "The sign-in service is not reachable right now. Try again in a moment." }, { status: 502 });
  }
}
