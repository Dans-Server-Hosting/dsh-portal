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
