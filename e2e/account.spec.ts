import { expect, test, type BrowserContext } from "@playwright/test";
import { MOCK_URL } from "../playwright.config";
import { createAtMock, registerAtMock, resetMock, signIn, snapshot, tokenFromMock } from "./helpers";

const USER = "account-user";
const ADMIN = "admin";
const DEAD_SESSION_SERVER = "dead-session";
const PASSWORD = "Acc0unt-test!";
const NEW_PASSWORD = "N3w-account-pw!";

const sessionCookie = async (context: BrowserContext) => (await context.cookies()).find((c) => c.name === "dsh_session");

/** Revokes the browser's token at UserAuth and leaves its cookie alone, as a password change elsewhere does. */
async function revokeSession(context: BrowserContext) {
  const token = (await sessionCookie(context))?.value;
  expect(token, "signed in").toBeTruthy();
  const logout = await fetch(`${MOCK_URL}/userauth/logout`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
  expect(logout.status).toBe(204);
}

test.beforeEach(async () => {
  await resetMock();
  await registerAtMock(USER, PASSWORD);
});

test("change password: wrong current, weak new, then success and sign in with the new one", async ({ page, context }, testInfo) => {
  // A second session, as if signed in on a phone too: it must be gone afterwards.
  const otherToken = await tokenFromMock(USER, PASSWORD);

  await signIn(page, USER, PASSWORD);
  const accountLink = page.getByTestId("account-link");
  await expect(accountLink).toHaveAttribute("href", "/account");
  await accountLink.click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Account");
  await expect(page.getByTestId("account-username")).toHaveText(USER);
  await snapshot(page, testInfo, "account");

  // ---- the checklist follows what is typed; a weak new password is refused before UserAuth is asked ----
  const rules = page.getByTestId("password-rule");
  await expect(rules).toHaveCount(6);
  await page.getByTestId("current-password-input").fill(PASSWORD);
  await page.getByTestId("new-password-input").fill("weak");
  await page.getByTestId("confirm-password-input").fill("weak");
  await expect(rules.filter({ hasText: "a lowercase letter" })).toHaveAttribute("data-ok", "true");
  await expect(rules.filter({ hasText: "an uppercase letter" })).toHaveAttribute("data-ok", "false");
  await page.getByTestId("change-password-submit").click();
  await expect(page.getByTestId("password-problem")).toContainText("The password needs");
  await expect(page.getByTestId("password-changed")).toHaveCount(0);

  // ---- the same as the current password is refused too ----
  await page.getByTestId("new-password-input").fill(PASSWORD);
  await page.getByTestId("confirm-password-input").fill(PASSWORD);
  await expect(rules.filter({ hasText: "different from your current password" })).toHaveAttribute("data-ok", "false");
  await page.getByTestId("change-password-submit").click();
  await expect(page.getByTestId("password-problem")).toContainText("must be different");

  // ---- a mismatch between the two new fields ----
  await page.getByTestId("new-password-input").fill(NEW_PASSWORD);
  await page.getByTestId("confirm-password-input").fill(NEW_PASSWORD + "x");
  await page.getByTestId("change-password-submit").click();
  await expect(page.getByTestId("password-problem")).toContainText("do not match");

  // ---- the wrong current password: UserAuth's 401, shown plainly, and still signed in ----
  await page.getByTestId("current-password-input").fill("Not-the-passw0rd!");
  await page.getByTestId("confirm-password-input").fill(NEW_PASSWORD);
  await page.getByTestId("change-password-submit").click();
  await expect(page.getByTestId("password-error")).toContainText("not your current password");
  await expect(page).toHaveURL(/\/account$/);
  await snapshot(page, testInfo, "account-wrong-current");

  // ---- a weak new password sent straight to the handler is its own 400, in the policy's words ----
  const weakUpstream = await page.request.post("/api/account/password", {
    data: { currentPassword: PASSWORD, newPassword: "weak" },
  });
  expect(weakUpstream.status()).toBe(400);
  expect(((await weakUpstream.json()) as { message: string }).message).toContain("password needs");

  // ---- success: 204, the note about other sessions, and the other session really is gone ----
  await page.getByTestId("current-password-input").fill(PASSWORD);
  await page.getByTestId("change-password-submit").click();
  const changed = page.getByTestId("password-changed");
  await expect(changed).toContainText("Your password was changed");
  await expect(changed).toContainText("signed out");
  await snapshot(page, testInfo, "account-changed");
  const other = await fetch(`${MOCK_URL}/userauth/session/validate`, { headers: { authorization: `Bearer ${otherToken}` } });
  expect(other.status, "the other session was signed out").toBe(401);
  const mine = (await context.cookies()).find((c) => c.name === "dsh_session");
  expect(mine, "this session is still there").toBeTruthy();
  await page.getByTestId("account-link").click();
  await expect(page).toHaveURL(/\/account$/);

  // ---- sign out, then only the new password works ----
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/auth/login");
  await page.getByTestId("username-input").fill(USER);
  await page.getByTestId("password-input").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("auth-error")).toContainText("do not match");
  await page.getByTestId("password-input").fill(NEW_PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/servers$/);
});

test("the password handler's own refusals, and a wrong password told apart from an expired session", async ({ page, context }) => {
  await signIn(page, USER, PASSWORD);
  const change = (data: unknown, headers?: Record<string, string>) => page.request.post("/api/account/password", { data, headers });

  // ---- refused by the handler before UserAuth is asked ----
  const notJson = await change("not json", { "content-type": "text/plain" });
  expect(notJson.status()).toBe(400);
  expect(await notJson.json()).toEqual({ message: "The request body must be JSON." });
  const noCurrent = await change({ newPassword: NEW_PASSWORD });
  expect(noCurrent.status()).toBe(400);
  expect(await noCurrent.json()).toEqual({ message: "Enter your current password." });

  // ---- UserAuth's 401 for a wrong current password is answered as a 403 while the session is alive ----
  const wrong = await change({ currentPassword: "Not-the-passw0rd!", newPassword: NEW_PASSWORD });
  expect(wrong.status()).toBe(403);
  expect(await wrong.json()).toEqual({ message: "That is not your current password." });

  // ---- once UserAuth no longer accepts the token, the same request is a 401 ----
  const token = (await context.cookies()).find((c) => c.name === "dsh_session")?.value;
  expect(token, "signed in").toBeTruthy();
  const logout = await fetch(`${MOCK_URL}/userauth/logout`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
  expect(logout.status).toBe(204);
  const expired = await change({ currentPassword: "Not-the-passw0rd!", newPassword: NEW_PASSWORD });
  expect(expired.status()).toBe(401);
  expect(await expired.json()).toEqual({ message: "Your session has expired." });
});

// The login page sends anyone with a cookie to /servers, so a dead token that
// kept its cookie would bounce between the two and never reach the form.
test("a session the API no longer accepts ends at the sign-in form, and signing in works again", async ({ page, context }) => {
  await signIn(page, USER, PASSWORD);
  await revokeSession(context);

  // The server list's next poll (10 s) is what finds out.
  await expect(page.getByTestId("login-submit")).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/auth\/login$/);
  expect(await sessionCookie(context), "the dead cookie is gone").toBeUndefined();

  await signIn(page, USER, PASSWORD);
  await expect(page.getByTestId("account-link")).toBeVisible();
});

// A server component cannot clear the cookie, so these pages have a proxy find
// out. The 5 s limit is under the list's 10 s poll, so the poll cannot pass this.
for (const path of ["/servers", `/servers/${DEAD_SESSION_SERVER}`, "/admin/feedback"]) {
  test(`${path} with a dead session goes to the sign-in form at once`, async ({ page, context }) => {
    await registerAtMock(ADMIN, PASSWORD);
    await createAtMock(await tokenFromMock(ADMIN, PASSWORD), DEAD_SESSION_SERVER);
    await signIn(page, ADMIN, PASSWORD);
    await revokeSession(context);

    await page.goto(path);
    await expect(page.getByTestId("login-submit")).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/auth\/login$/);
    expect(await sessionCookie(context), "the dead cookie is gone").toBeUndefined();
  });
}

test("a dead session the proxy cannot confirm is told so, not left waiting", async ({ page, context }, testInfo) => {
  await signIn(page, USER, PASSWORD);
  await revokeSession(context);
  await page.route("/api/servers", (route) => route.fulfill({ status: 502, json: { message: "The proxy is down." } }));

  await page.goto("/servers");
  await expect(page.getByTestId("session-unconfirmed")).toContainText("could not be checked");
  await expect(page.getByTestId("session-expired")).toHaveCount(0);
  await expect(page.getByText("bearer token")).toHaveCount(0);
  await snapshot(page, testInfo, "session-unconfirmed");
});

test("the password handler clears the cookie of a session that has expired", async ({ page, context }) => {
  await signIn(page, USER, PASSWORD);
  await revokeSession(context);
  const expired = await page.request.post("/api/account/password", {
    data: { currentPassword: "Not-the-passw0rd!", newPassword: NEW_PASSWORD },
  });
  expect(expired.status()).toBe(401);
  expect(await sessionCookie(context), "the dead cookie is gone").toBeUndefined();
});

// UserAuth's other refusals reach the form with the handler's own words, not a sentence about servers or feedback.
for (const status of [404, 422, 429]) {
  test(`a ${status} on the password form shows the handler's message`, async ({ page }) => {
    await signIn(page, USER, PASSWORD);
    await page.goto("/account");
    await page.route("/api/account/password", (route) => route.fulfill({ status, json: { message: "UserAuth refused this." } }));
    await page.getByTestId("current-password-input").fill(PASSWORD);
    await page.getByTestId("new-password-input").fill(NEW_PASSWORD);
    await page.getByTestId("confirm-password-input").fill(NEW_PASSWORD);
    await page.getByTestId("change-password-submit").click();
    await expect(page.getByTestId("password-error")).toHaveText("UserAuth refused this.");
  });
}

test("the password handler answers a body that is not a JSON object with its own 400", async ({ page }) => {
  await signIn(page, USER, PASSWORD);
  for (const data of ["null", "[]", "5"]) {
    const response = await page.request.post("/api/account/password", { data, headers: { "content-type": "application/json" } });
    expect(response.status(), data).toBe(400);
    expect(await response.json(), data).toEqual({ message: "The request body must be JSON." });
  }
});

test("the account page and its handler need a sign-in", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/auth\/login$/);
  const response = await page.request.post("/api/account/password", { data: { currentPassword: "a", newPassword: "b" } });
  expect(response.status()).toBe(401);
});
