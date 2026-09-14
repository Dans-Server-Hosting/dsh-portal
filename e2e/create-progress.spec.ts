import { expect, test } from "@playwright/test";
import { advanceMock, createAtMock, registerAtMock, resetMock, setMockState, signIn, snapshot, tokenFromMock } from "./helpers";

const USER = "progress-user";
const PASSWORD = "Pr0gress-test!";
const SERVER = "progress-test";

test.beforeEach(async () => {
  await resetMock();
  await registerAtMock(USER, PASSWORD);
});

test("create → 202 → progress → online", async ({ page }, testInfo) => {
  await signIn(page, USER, PASSWORD);
  await page.goto("/servers/new");

  // ---- while the request is in flight the button is disabled and says so ----
  // The mock answers at once, so the first create is held back for a moment to look at.
  let held = false;
  await page.route("**/api/servers", async (route) => {
    if (route.request().method() === "POST" && !held) {
      held = true;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    await route.continue();
  });
  await page.getByTestId("name-input").fill(SERVER);
  await page.getByTestId("create-submit").click();
  await expect(page.getByTestId("create-submit")).toBeDisabled();
  await expect(page.getByTestId("create-submit")).toHaveText("Creating…");
  await expect(page.getByTestId("create-progress")).toContainText("Creating your server");
  await snapshot(page, testInfo, "creating");

  // ---- 202: the created view appears at once, with the address, the password and a live status ----
  const created = page.getByTestId("created");
  await expect(created).toBeVisible();
  await expect(created).toContainText(`${SERVER}.example.com`);
  await expect(created).toContainText("Dashboard password");
  await expect(page.getByTestId("created-banner")).toContainText(`${SERVER} is being set up`);
  const status = page.getByTestId("create-status");
  await expect(status).toHaveAttribute("data-state", "provisioning");
  await expect(status).toHaveText("Setting up… usually about a minute");
  await snapshot(page, testInfo, "created-provisioning");

  // ---- the mock advances; the status line follows within a poll, without a reload ----
  await page.evaluate(() => {
    (window as unknown as { __noReloadMarker: number }).__noReloadMarker = 42;
  });
  await advanceMock(SERVER);
  await expect(status).toHaveAttribute("data-state", "waking", { timeout: 15_000 });
  await expect(status).toHaveText("Starting…");
  await advanceMock(SERVER);
  await expect(status).toHaveAttribute("data-state", "awake", { timeout: 15_000 });
  await expect(status).toHaveText("Online — ready to join");
  await expect(page.getByTestId("created-banner")).toContainText(`${SERVER} is ready`);
  expect(await page.evaluate(() => (window as unknown as { __noReloadMarker?: number }).__noReloadMarker)).toBe(42);
  await snapshot(page, testInfo, "created-online");

  // ---- the list and the detail page agree ----
  await page.getByTestId("view-created").click();
  await expect(page).toHaveURL(new RegExp(`/servers/${SERVER}$`));
  await expect(page.getByTestId("state-pill")).toHaveAttribute("data-state", "awake");
});

test("a second create while one is provisioning says so and links to it", async ({ page }, testInfo) => {
  const token = await tokenFromMock(USER, PASSWORD);
  await createAtMock(token, SERVER);
  await signIn(page, USER, PASSWORD);
  await page.goto("/servers/new");
  await page.getByTestId("name-input").fill("another-one");
  await page.getByTestId("create-submit").click();
  const error = page.getByTestId("create-error");
  await expect(error).toContainText("A server is already being created for your account");
  await expect(error).not.toContainText("server limit");
  await expect(page.getByTestId("in-progress-link")).toHaveAttribute("href", `/servers/${SERVER}`);
  await expect(page.getByTestId("create-submit")).toBeEnabled();
  await snapshot(page, testInfo, "create-already-in-progress");
  await page.getByTestId("in-progress-link").click();
  await expect(page).toHaveURL(new RegExp(`/servers/${SERVER}$`));
  await expect(page.getByTestId("state-pill")).toHaveAttribute("data-state", "provisioning");

  // ---- once it is no longer provisioning, a second create is the cap again ----
  await setMockState(SERVER, "awake", 0);
  await page.goto("/servers/new");
  await page.getByTestId("name-input").fill("another-one");
  await page.getByTestId("create-submit").click();
  await expect(page.getByTestId("create-error")).toContainText("server limit");
});

test("provisioning and stopped are shown on the list and the detail page", async ({ page }, testInfo) => {
  const token = await tokenFromMock(USER, PASSWORD);
  await createAtMock(token, SERVER);
  await signIn(page, USER, PASSWORD);

  // ---- provisioning: a pill, and Wake does nothing yet ----
  const card = page.getByTestId("server-card").filter({ hasText: SERVER });
  await expect(card.getByTestId("state-pill")).toHaveAttribute("data-state", "provisioning");
  await expect(card.getByTestId("state-pill")).toHaveText("provisioning");
  await expect(card.getByTestId("wake-button")).toBeDisabled();
  await snapshot(page, testInfo, "servers-list-provisioning");
  await card.getByRole("link", { name: SERVER }).click();
  await expect(page).toHaveURL(new RegExp(`/servers/${SERVER}$`));
  await expect(page.getByTestId("state-pill")).toHaveAttribute("data-state", "provisioning");
  await expect(page.getByTestId("state-description")).toContainText("Being set up");
  await expect(page.getByTestId("wake-button")).toBeDisabled();
  await snapshot(page, testInfo, "server-detail-provisioning");

  // ---- stopped: "Stopped", and Wake is the way back ----
  await setMockState(SERVER, "stopped", null);
  await expect(page.getByTestId("state-pill")).toHaveAttribute("data-state", "stopped", { timeout: 20_000 });
  await expect(page.getByTestId("state-pill")).toHaveText("stopped");
  await expect(page.getByTestId("state-pill")).toHaveCSS("text-transform", "capitalize");
  await expect(page.getByTestId("state-description")).toContainText("Stopped");
  await expect(page.getByTestId("wake-button")).toBeEnabled();
  await snapshot(page, testInfo, "server-detail-stopped");
  await page.getByTestId("wake-button").click();
  await expect(page.getByTestId("state-pill")).toHaveAttribute("data-state", "waking");
  await expect(page.getByTestId("state-pill")).toHaveAttribute("data-state", "awake", { timeout: 20_000 });

  await page.goto("/servers");
  await setMockState(SERVER, "stopped", null);
  await expect(card.getByTestId("state-pill")).toHaveAttribute("data-state", "stopped", { timeout: 20_000 });
  await expect(card.getByTestId("wake-button")).toBeEnabled();
  await snapshot(page, testInfo, "servers-list-stopped");
});
