import { expect, test } from "@playwright/test";
import { MOCK_URL } from "../playwright.config";
import { registerAtMock, resetMock, signIn, snapshot, tokenFromMock } from "./helpers";

const USER = "account-user";
const PASSWORD = "Acc0unt-test!";
const NEW_PASSWORD = "N3w-account-pw!";

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

  // ---- UserAuth's own 400 comes through the route handler as it was said ----
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

test("the account page and its handler need a sign-in", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/auth\/login$/);
  const response = await page.request.post("/api/account/password", { data: { currentPassword: "a", newPassword: "b" } });
  expect(response.status()).toBe(401);
});
