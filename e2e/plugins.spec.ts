import { expect, test, type Page } from "@playwright/test";
import {
  createAtMock,
  registerAtMock,
  resetMock,
  setMockPluginSelection,
  setMockState,
  signIn,
  snapshot,
  tokenFromMock,
} from "./helpers";

// RFC 0020: one-button install and remove from the Dan's Plugins catalog.
const SERVER = "plugin-test";
const USER = "plugin-user";
const PASSWORD = "Plug1n-test!";

test.beforeEach(async () => {
  await resetMock();
  await registerAtMock(USER, PASSWORD);
  await createAtMock(await tokenFromMock(USER, PASSWORD), SERVER);
  await setMockState(SERVER, "asleep", null);
});

const installed = (page: Page, slug: string) => page.locator(`[data-testid="installed-plugin"][data-slug="${slug}"]`);
const inCatalog = (page: Page, slug: string) => page.locator(`[data-testid="catalog-plugin"][data-slug="${slug}"]`);

async function install(page: Page, slug: string) {
  await page.getByTestId("add-plugins").click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByTestId("catalog-plugin").first()).toBeVisible();
  await inCatalog(page, slug).getByTestId("install-plugin").click();
  await expect(sheet.getByTestId("install-notice")).toBeVisible();
  await sheet.getByTestId("catalog-close").click();
  await expect(sheet).toBeHidden();
}

async function remove(page: Page, slug: string) {
  await installed(page, slug).getByTestId("remove-plugin").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Its data stays on the server");
  await dialog.getByTestId("remove-confirm").click();
  await expect(installed(page, slug)).toHaveCount(0);
}

test("install with a dependency, then remove it and the dependency", async ({ page }, testInfo) => {
  await signIn(page, USER, PASSWORD);
  await page.goto(`/servers/${SERVER}`);
  const section = page.getByTestId("plugins-section");

  // ---- what the server came with; a dependency cannot be removed on its own ----
  await expect(section.getByTestId("installed-plugin")).toHaveCount(3);
  await expect(installed(page, "viaversion").getByTestId("needed-by")).toHaveText("Needed by ViaBackwards");
  await expect(installed(page, "viaversion").getByTestId("remove-plugin")).toBeDisabled();
  await expect(installed(page, "viabackwards").getByTestId("remove-plugin")).toBeEnabled();
  await expect(page.getByTestId("plugins-pending")).toHaveCount(0);
  await expect(page.getByText("Installed by default")).toHaveCount(0);

  // ---- the catalog: a bottom sheet on the phone, a dialog on desktop ----
  await page.getByTestId("add-plugins").click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Add plugins" })).toBeVisible();
  await expect(inCatalog(page, "fiefs")).toContainText("Lets faction members claim land");
  await expect(inCatalog(page, "fiefs").getByTestId("also-installs")).toHaveText("Also installs Medieval Factions");
  await expect(inCatalog(page, "viaversion").getByTestId("install-plugin")).toHaveText("Installed");
  await expect(inCatalog(page, "viaversion").getByTestId("install-plugin")).toBeDisabled();
  await expect(inCatalog(page, "fiefs").getByRole("link", { name: "Fiefs" })).toHaveAttribute(
    "href",
    "https://dansplugins.com/resources/fiefs",
  );
  // the sheet is in place (no slide in progress) before it is pictured
  await expect(sheet.getByTestId("catalog-search")).toBeInViewport();
  await page.waitForTimeout(400);
  await snapshot(page, testInfo, "plugin-catalog");

  // search narrows the list
  await sheet.getByTestId("catalog-search").fill("factions");
  await expect(sheet.getByTestId("catalog-plugin")).toHaveCount(3);
  await sheet.getByTestId("catalog-search").fill("");

  // ---- install: Fiefs brings Medieval Factions with it ----
  await inCatalog(page, "fiefs").getByTestId("install-plugin").click();
  await expect(sheet.getByTestId("install-notice")).toContainText("Fiefs added, with Medieval Factions.");
  await expect(inCatalog(page, "fiefs").getByTestId("install-plugin")).toHaveText("Installed");
  await expect(inCatalog(page, "medieval-factions").getByTestId("install-plugin")).toHaveText("Installed");
  await expect(inCatalog(page, "currencies").getByTestId("also-installs")).toHaveCount(0);
  await sheet.getByTestId("catalog-close").click();
  await expect(sheet).toBeHidden();

  await expect(section.getByTestId("installed-plugin")).toHaveCount(5);
  await expect(installed(page, "fiefs").getByTestId("plugin-status")).toHaveText("Installs at next start");
  await expect(installed(page, "medieval-factions").getByTestId("needed-by")).toHaveText("Needed by Fiefs");
  await expect(installed(page, "medieval-factions").getByTestId("remove-plugin")).toBeDisabled();
  // asleep: nothing to restart, it applies at the next wake
  const pending = page.getByTestId("plugins-pending");
  await expect(pending).toContainText("the next time the server starts");
  await expect(pending.getByTestId("apply-button")).toHaveCount(0);
  await snapshot(page, testInfo, "plugins-pending");

  // ---- remove: the dependency nothing needs any more is offered, not removed unasked ----
  await remove(page, "fiefs");
  const offer = page.getByTestId("unused-offer");
  await expect(offer).toContainText("Medieval Factions is no longer needed by anything. Remove it too?");
  await expect(installed(page, "medieval-factions")).toHaveCount(1);
  await snapshot(page, testInfo, "plugins-unused-offer");
  await offer.getByTestId("unused-remove").click();
  await expect(installed(page, "medieval-factions")).toHaveCount(0);
  await expect(offer).toBeHidden();
  // back to what the server started with: nothing waits for a restart
  await expect(pending).toBeHidden();
});

test("an awake server restarts to apply, and asks first when players are online", async ({ page }, testInfo) => {
  await signIn(page, USER, PASSWORD);
  await page.goto(`/servers/${SERVER}`);
  await install(page, "medieval-factions");

  // ---- awake, nobody online: Restart to apply restarts straight away ----
  await setMockState(SERVER, "awake", 0);
  await page.reload();
  const pending = page.getByTestId("plugins-pending");
  await expect(pending).toContainText("when the server restarts");
  await snapshot(page, testInfo, "plugins-restart-to-apply");
  await pending.getByTestId("apply-button").click();
  await expect(page.getByTestId("plugins-restarting")).toBeVisible();
  // The restart (2 s in the mock) is shorter than a poll, so "waking" may
  // never be seen; what shows it happened is the change no longer pending.
  await expect(installed(page, "medieval-factions").getByTestId("plugin-status")).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByTestId("plugins-restarting")).toBeHidden();
  await expect(pending).toBeHidden();

  // ---- awake with players: asked first; "Not now" leaves it pending ----
  await remove(page, "medieval-factions");
  await setMockState(SERVER, "awake", 2);
  await page.reload();
  await pending.getByTestId("apply-button").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("2 players are online. Restart now?");
  await dialog.getByRole("button", { name: "Not now" }).click();
  await expect(dialog).toBeHidden();
  await expect(pending).toBeVisible();
  await expect(page.getByTestId("state-pill")).toHaveAttribute("data-state", "awake");

  await pending.getByTestId("apply-button").click();
  await dialog.getByTestId("restart-confirm").click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("plugins-restarting")).toBeVisible();
  await expect(page.getByTestId("state-pill")).toHaveAttribute("data-state", "awake", { timeout: 30_000 });
  await expect(pending).toBeHidden({ timeout: 20_000 });
});

test("while plugin selection is switched off, the server page lists the default plugins", async ({ page }) => {
  await setMockPluginSelection(false);
  await signIn(page, USER, PASSWORD);
  await page.goto(`/servers/${SERVER}`);
  await expect(page.getByText("Installed by default")).toBeVisible();
  await expect(page.getByTestId("default-plugins").getByRole("listitem")).toHaveCount(3);
  await expect(page.getByTestId("plugins-section")).toHaveCount(0);
});

test("the catalog proxy needs no sign-in; the server's plugin proxies do", async ({ page }) => {
  const catalog = await page.request.get("/api/catalog");
  expect(catalog.status()).toBe(200);
  expect(((await catalog.json()) as { slug: string }[]).map((p) => p.slug)).toContain("medieval-factions");

  expect((await page.request.get(`/api/servers/${SERVER}/plugins`)).status()).toBe(401);
  expect((await page.request.put(`/api/servers/${SERVER}/plugins/fiefs`)).status()).toBe(401);
  expect((await page.request.delete(`/api/servers/${SERVER}/plugins/viabackwards`)).status()).toBe(401);
  expect((await page.request.post(`/api/servers/${SERVER}/plugins/apply`, { data: { confirm_players: true } })).status()).toBe(401);
});

test("apply only confirms a restart over players when the browser sends exactly true", async ({ page }) => {
  await signIn(page, USER, PASSWORD);
  await setMockState(SERVER, "awake", 2);
  const apply = (data?: unknown) => page.request.post(`/api/servers/${SERVER}/plugins/apply`, data === undefined ? {} : { data });

  for (const data of [undefined, {}, { confirm_players: "true" }, { confirm_players: 1 }, { confirm_players: false }]) {
    const refused = await apply(data);
    expect(refused.status(), JSON.stringify(data)).toBe(409);
    expect(((await refused.json()) as { players_online?: number }).players_online).toBe(2);
  }

  const confirmed = await apply({ confirm_players: true });
  expect(confirmed.status()).toBe(202);
  expect(await confirmed.json()).toEqual({ applies: "restarting" });
});
