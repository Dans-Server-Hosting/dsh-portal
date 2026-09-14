import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MOCK_URL } from "../playwright.config";

const SERVER = "smoke-test";
const SCREENSHOT_DIR = path.join(__dirname, "..", "test-results", "screenshots");

/** Full-page screenshot per project, plus a check that nothing overflows sideways. */
async function snapshot(page: Page, testInfo: TestInfo, name: string) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const file = path.join(SCREENSHOT_DIR, `${testInfo.project.name}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(`${testInfo.project.name}-${name}`, { path: file, contentType: "image/png" });
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(overflow.scrollWidth, `${name} must not scroll horizontally`).toBeLessThanOrEqual(overflow.innerWidth);
}

async function setMockState(state: string, playersOnline: number | null) {
  const response = await fetch(`${MOCK_URL}/mock/servers/${SERVER}/state`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ state, players_online: playersOnline }),
  });
  expect(response.ok).toBeTruthy();
}

test.beforeEach(async () => {
  await fetch(`${MOCK_URL}/mock/reset`, { method: "POST" });
});

test("create → see → delete", async ({ page, context }, testInfo) => {
  // ---- landing: limits come from the API, and there is a Sign in ----
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("free Minecraft server");
  const limits = page.getByTestId("limits");
  await expect(limits).toContainText("Minecraft 26.2");
  await expect(limits).toContainText("3G heap");
  await expect(limits).toContainText("1 server");
  await expect(page.getByText("After 20 minutes with nobody online")).toBeVisible();
  await snapshot(page, testInfo, "landing");

  // ---- sign in through (mock) UserAuth; the JWT lands in an httpOnly cookie ----
  await page.getByTestId("sign-in").click();
  await expect(page).toHaveURL(/\/servers$/);
  const session = (await context.cookies()).find((c) => c.name === "dsh_session");
  expect(session, "session cookie is set").toBeTruthy();
  expect(session!.httpOnly).toBe(true);
  expect(session!.sameSite).toBe("Lax");
  expect(session!.secure).toBe(true);
  expect(session!.value.split(".")).toHaveLength(3);
  expect(await page.evaluate(() => document.cookie)).not.toContain("dsh_session");
  await expect(page.getByTestId("empty-state")).toBeVisible();
  await snapshot(page, testInfo, "servers-empty");

  // ---- create ----
  await page.getByTestId("create-server-link").click();
  await expect(page).toHaveURL(/\/servers\/new$/);
  await snapshot(page, testInfo, "servers-new");

  await page.getByTestId("name-input").fill("Bad Name!");
  await page.getByTestId("create-submit").click();
  await expect(page.getByText("Use 2-31 lowercase letters")).toBeVisible();

  await page.getByTestId("name-input").fill(SERVER);
  await page.getByTestId("motd-input").fill("Smoke test world");
  await page.getByTestId("operator-input").fill("Steve");
  await page.getByTestId("create-submit").click();
  const created = page.getByTestId("created");
  await expect(created).toBeVisible();
  await expect(created).toContainText(`${SERVER}.example.com`);
  await expect(created).toContainText("Dashboard password");
  await expect(created).toContainText("mock-");
  await snapshot(page, testInfo, "created");

  // ---- see: the detail page ----
  await page.getByTestId("view-created").click();
  await expect(page).toHaveURL(new RegExp(`/servers/${SERVER}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SERVER);
  await expect(page.getByTestId("state-pill")).toHaveAttribute("data-state", "asleep");
  await expect(page.getByTestId("last-woken")).toHaveText("never");
  await expect(page.getByTestId("server-address")).toHaveText(`${SERVER}.example.com`);
  await expect(page.getByRole("link", { name: /dashboard/i }).first()).toHaveAttribute("href", `https://${SERVER}.example.com/dashboard`);
  await snapshot(page, testInfo, "server-detail");

  // ---- wake: asleep → waking immediately, → awake by the next poll ----
  await page.getByTestId("wake-button").click();
  await expect(page.getByTestId("state-pill")).toHaveAttribute("data-state", "waking");
  await expect(page.getByTestId("state-pill")).toHaveAttribute("data-state", "awake", { timeout: 20_000 });
  await expect(page.getByTestId("last-woken")).not.toHaveText("never");

  // ---- the list: a player joins and the pill flips without a reload ----
  await setMockState("asleep", null);
  await page.goto("/servers");
  const card = page.getByTestId("server-card").filter({ hasText: SERVER });
  await expect(card).toBeVisible();
  await expect(card.getByTestId("state-pill")).toHaveAttribute("data-state", "asleep");
  await page.evaluate(() => {
    (window as unknown as { __noReloadMarker: number }).__noReloadMarker = 42;
  });
  await setMockState("awake", 1);
  await expect(card.getByTestId("state-pill")).toHaveAttribute("data-state", "awake", { timeout: 20_000 });
  await expect(card).toContainText("1 online");
  expect(await page.evaluate(() => (window as unknown as { __noReloadMarker?: number }).__noReloadMarker)).toBe(42);
  await expect(page.getByTestId("create-server-link")).toBeDisabled();
  await snapshot(page, testInfo, "servers-list");

  // ---- the cap: a second server is refused in plain language ----
  await page.goto("/servers/new");
  await page.getByTestId("name-input").fill("second-server");
  await page.getByTestId("create-submit").click();
  await expect(page.getByTestId("create-error")).toContainText("server limit");

  // ---- delete: typed confirmation, backup notice, players-online guard ----
  await page.goto("/servers");
  await card.getByTestId("delete-button").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("A backup of the world is taken first");
  const confirmButton = dialog.getByTestId("delete-confirm-button");
  await expect(confirmButton).toBeDisabled();
  await dialog.getByTestId("delete-confirm-input").fill("smoke-tset");
  await expect(confirmButton).toBeDisabled();
  await dialog.getByTestId("delete-confirm-input").fill(SERVER);
  await expect(confirmButton).toBeEnabled();
  // Let the dialog's fade-in finish so the screenshot shows its settled state.
  await expect(page.locator(".MuiDialog-container")).toHaveCSS("opacity", "1");
  await snapshot(page, testInfo, "delete-dialog");

  await confirmButton.click();
  await expect(dialog).toContainText("Players are online");
  await expect(confirmButton).toBeDisabled();
  await dialog.getByTestId("delete-force").check();
  await confirmButton.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("empty-state")).toBeVisible();
  await expect(page.getByTestId("server-card")).toHaveCount(0);

  // ---- sign out clears the cookie ----
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect((await context.cookies()).find((c) => c.name === "dsh_session")).toBeUndefined();
  await expect(page.getByTestId("sign-in")).toBeVisible();
});

test("protected pages send a signed-out visitor through sign-in", async ({ page }) => {
  await page.goto("/servers/new");
  // The mock UserAuth signs in instantly, so the round trip ends on /servers.
  await expect(page).toHaveURL(/\/servers$/);
});

test("a bad callback does not create a session", async ({ page, context }) => {
  await page.goto("/auth/callback?token=not-a-jwt");
  await expect(page).toHaveURL(/\/\?error=sign-in-failed$/);
  await expect(page.getByText("Sign-in did not complete")).toBeVisible();
  expect((await context.cookies()).find((c) => c.name === "dsh_session")).toBeUndefined();
});
