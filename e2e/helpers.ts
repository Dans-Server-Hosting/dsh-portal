import { expect, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MOCK_URL } from "../playwright.config";

const SCREENSHOT_DIR = path.join(__dirname, "..", "test-results", "screenshots");

/** Full-page screenshot per project, plus a check that nothing overflows sideways. */
export async function snapshot(page: Page, testInfo: TestInfo, name: string) {
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

export async function resetMock() {
  const response = await fetch(`${MOCK_URL}/mock/reset`, { method: "POST" });
  expect(response.ok).toBeTruthy();
}

/** Creates the account straight at the mock UserAuth, skipping the form. */
export async function registerAtMock(username: string, password: string) {
  const response = await fetch(`${MOCK_URL}/userauth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  expect(response.status).toBe(201);
}

/** A bearer token from the mock UserAuth, for talking to the mock API directly. */
export async function tokenFromMock(username: string, password: string): Promise<string> {
  const response = await fetch(`${MOCK_URL}/userauth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { token: string }).token;
}

/** Signs in on the portal's own form and lands on /servers. */
export async function signIn(page: Page, username: string, password: string) {
  await page.goto("/auth/login");
  await page.getByTestId("username-input").fill(username);
  await page.getByTestId("password-input").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/servers$/);
}

/** Moves a mock server one step along provisioning → waking → awake. */
export async function advanceMock(name: string) {
  const response = await fetch(`${MOCK_URL}/mock/servers/${name}/advance`, { method: "POST" });
  expect(response.ok).toBeTruthy();
}

/** Sets a mock server's state outright (and stops its automatic progression). */
export async function setMockState(name: string, state: string, playersOnline: number | null = null) {
  const response = await fetch(`${MOCK_URL}/mock/servers/${name}/state`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ state, players_online: playersOnline }),
  });
  expect(response.ok).toBeTruthy();
}

/** Creates a server straight at the mock API; it comes back 202 in state `provisioning`. */
export async function createAtMock(token: string, name: string) {
  const response = await fetch(`${MOCK_URL}/api/v1/servers`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  expect(response.status).toBe(202);
}
