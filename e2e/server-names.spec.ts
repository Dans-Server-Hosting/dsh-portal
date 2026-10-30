import { expect, test } from "@playwright/test";
import { createAtMock, registerAtMock, resetMock, signIn, snapshot, tokenFromMock } from "./helpers";

const USER = "names-user";
const OTHER = "names-other";
const PASSWORD = "N4mes-test!";
const OTHERS_SERVER = "taken-name";

test.beforeEach(async () => {
  await resetMock();
  await registerAtMock(USER, PASSWORD);
  await registerAtMock(OTHER, PASSWORD);
  // Server names are one namespace across accounts: this one belongs to someone else.
  await createAtMock(await tokenFromMock(OTHER, PASSWORD), OTHERS_SERVER);
});

test("a name another account has is refused as taken, and a different one works", async ({ page }, testInfo) => {
  await signIn(page, USER, PASSWORD);
  await page.goto("/servers/new");
  await page.getByTestId("name-input").fill(OTHERS_SERVER);
  await page.getByTestId("create-submit").click();
  // The API's 409 without a pending server is the name, not "already being created".
  const error = page.getByTestId("create-error");
  await expect(error).toHaveText("That name is already taken. Pick another.");
  await expect(page.getByTestId("in-progress-link")).toHaveCount(0);
  await expect(page.getByTestId("create-submit")).toBeEnabled();
  await snapshot(page, testInfo, "create-name-taken");

  await page.getByTestId("name-input").fill("untaken-name");
  await page.getByTestId("create-submit").click();
  await expect(page.getByTestId("created")).toContainText("untaken-name.example.com");
});

test("a name containing omcsi is refused before anything is sent", async ({ page }) => {
  await signIn(page, USER, PASSWORD);
  await page.goto("/servers/new");
  let posted = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/servers") posted += 1;
  });
  await page.getByTestId("name-input").fill("my-omcsi-world");
  await page.getByTestId("create-submit").click();
  await expect(page.getByText('The name must not contain "omcsi".')).toBeVisible();
  await expect(page.getByTestId("created")).toHaveCount(0);
  expect(posted, "nothing is sent while the name is refused").toBe(0);
});

// The form trims before it sends, so these go to the proxy directly: it trims
// the name and MOTD itself and leaves a blank MOTD out for dsh-api's default.
test("the create proxy trims the name and MOTD", async ({ page }) => {
  await signIn(page, USER, PASSWORD);
  const created = await page.request.post("/api/servers", { data: { name: "  padded-name  ", motd: "  Padded world  " } });
  expect(created.status()).toBe(202);
  expect(await created.json()).toMatchObject({ name: "padded-name", motd: "Padded world" });
});

test("the create proxy leaves a blank MOTD out", async ({ page }) => {
  await signIn(page, USER, PASSWORD);
  const created = await page.request.post("/api/servers", { data: { name: "blank-motd", motd: "   " } });
  expect(created.status()).toBe(202);
  expect(await created.json()).toMatchObject({ name: "blank-motd", motd: "A Minecraft Server" });
});

test("a server that is not yours, or does not exist, is the not-found page", async ({ page }, testInfo) => {
  await signIn(page, USER, PASSWORD);
  for (const name of [OTHERS_SERVER, "no-such-server"]) {
    await page.goto(`/servers/${name}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Not found");
    await expect(page.getByTestId("state-pill")).toHaveCount(0);
  }
  await snapshot(page, testInfo, "server-not-found");
});
