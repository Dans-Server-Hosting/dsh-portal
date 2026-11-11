import { expect, test, type Page } from "@playwright/test";
import {
  createAtMock,
  mockApiCalls,
  registerAtMock,
  resetMock,
  setMockLimits,
  setMockState,
  setMockThumbnails,
  signIn,
  snapshot,
  tokenFromMock,
} from "./helpers";

// RFC 0034: a small rotating picture of the world around spawn, owner-only.
const SERVER = "thumb-test";
const USER = "thumb-user";
const PASSWORD = "Thumb-test1!";

test.beforeEach(async () => {
  await resetMock();
  await registerAtMock(USER, PASSWORD);
  await createAtMock(await tokenFromMock(USER, PASSWORD), SERVER);
  await setMockState(SERVER, "asleep", null);
});

async function press(page: Page, testId: string, isMobile: boolean) {
  const button = page.getByTestId(testId);
  if (isMobile) await button.tap();
  else await button.click();
}

async function drawPicture(page: Page, isMobile: boolean) {
  const section = page.getByTestId("thumbnail-section");
  await press(page, "thumbnail-refresh", isMobile);
  await expect(section.getByTestId("thumbnail-progress")).toBeVisible();
  await expect(section.getByTestId("thumbnail-refresh")).toBeDisabled();
  await expect(section).toHaveAttribute("data-status", "ready", { timeout: 20_000 });
  return section;
}

/** The <img> has really loaded and decoded (not a broken-image box). */
async function expectLoaded(page: Page, scope: ReturnType<Page["getByTestId"]>) {
  const img = scope.getByTestId("thumbnail-img");
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(200);
  return img;
}

test("nothing is shown while thumbnails are switched off", async ({ page }) => {
  await setMockThumbnails("off");
  await signIn(page, USER, PASSWORD);
  await expect(page.getByTestId("server-card")).toBeVisible();
  await expect(page.getByTestId("thumbnail-picture")).toHaveCount(0);
  await page.goto(`/servers/${SERVER}`);
  await expect(page.getByTestId("state-description")).toBeVisible();
  await expect(page.getByTestId("thumbnail-section")).toHaveCount(0);
});

test("draw a picture, see it on the detail page and the card", async ({ page, isMobile }, testInfo) => {
  await setMockThumbnails("manual");
  await signIn(page, USER, PASSWORD);
  // No picture yet: the card renders exactly as it did before.
  await expect(page.getByTestId("server-card")).toBeVisible();
  await expect(page.getByTestId("thumbnail-picture")).toHaveCount(0);

  await page.goto(`/servers/${SERVER}`);
  const section = page.getByTestId("thumbnail-section");
  await expect(section.getByTestId("thumbnail-none")).toBeVisible();
  await expect(section.getByTestId("thumbnail-refresh")).toHaveText("Draw a picture");

  await drawPicture(page, isMobile);
  const img = await expectLoaded(page, section);
  await expect(img).toHaveAttribute("alt", `3D picture of the world around spawn on ${SERVER}`);
  await expect(section.getByTestId("thumbnail-caption")).toContainText("Around spawn, as of");
  await expect(section.getByTestId("thumbnail-caption")).toContainText("your world itself is never changed");
  await expect(section.getByTestId("thumbnail-refresh")).toHaveText("Refresh picture");
  // The picture is a same-origin portal path, animated WebP, private caching.
  const src = await img.getAttribute("src");
  expect(src).toMatch(new RegExp(`^/api/servers/${SERVER}/thumbnail/thumb\\.webp\\?v=`));
  const response = await page.request.get(src!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/webp");
  expect(response.headers()["cache-control"]).toBe("private, max-age=300");
  const bytes = await response.body();
  expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
  expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
  // An unchanged picture costs a 304.
  const again = await page.request.get(src!, { headers: { "if-none-match": response.headers().etag } });
  expect(again.status()).toBe(304);
  await snapshot(page, testInfo, "thumbnail-detail");

  await page.goto("/servers");
  const card = page.getByTestId("server-card");
  await expectLoaded(page, card);
  await snapshot(page, testInfo, "thumbnail-card");
  // The picture on the card leads to the server's page.
  await press(page, "thumbnail-picture", isMobile);
  await expect(page).toHaveURL(new RegExp(`/servers/${SERVER}$`));
});

test("reduced motion gets the still poster", async ({ page, isMobile }) => {
  await setMockThumbnails("manual");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, USER, PASSWORD);
  await page.goto(`/servers/${SERVER}`);
  const section = await drawPicture(page, isMobile);
  const img = await expectLoaded(page, section);
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.currentSrc)).toMatch(/\/thumbnail\/poster\.png\?v=/);
});

test("a failed refresh says why and keeps the previous picture", async ({ page, isMobile }) => {
  await setMockThumbnails("manual");
  await signIn(page, USER, PASSWORD);
  await page.goto(`/servers/${SERVER}`);
  await drawPicture(page, isMobile);
  await setMockThumbnails("manual", { error: "the picture came out blank; is there anything built around spawn?" });
  const section = page.getByTestId("thumbnail-section");
  await press(page, "thumbnail-refresh", isMobile);
  await expect(section).toHaveAttribute("data-status", "failed", { timeout: 20_000 });
  await expect(section.getByTestId("thumbnail-failed")).toContainText("came out blank");
  await expect(section.getByTestId("thumbnail-failed")).toContainText("The previous picture is kept.");
  await expectLoaded(page, section);
});

test("the daily limit is explained", async ({ page, isMobile }) => {
  await setMockThumbnails("manual");
  await setMockLimits({ thumbnail_daily_limit: 1 });
  await signIn(page, USER, PASSWORD);
  await page.goto(`/servers/${SERVER}`);
  await drawPicture(page, isMobile);
  await press(page, "thumbnail-refresh", isMobile);
  await expect(page.getByTestId("thumbnail-error")).toContainText("The picture can be refreshed a few times a day. Try again in");
});

test("only the two picture files are proxied, and only with a session", async ({ page }) => {
  await setMockThumbnails("manual");
  const before = await mockApiCalls();
  const anonymous = await page.request.get(`/api/servers/${SERVER}/thumbnail/thumb.webp`);
  expect(anonymous.status()).toBe(401);
  await signIn(page, USER, PASSWORD);
  const calls = await mockApiCalls();
  for (const file of ["thumbnail.json", "strip.webp", "..%2Fthumbnail.json"]) {
    const response = await page.request.get(`/api/servers/${SERVER}/thumbnail/${file}`);
    expect(response.status()).toBe(404);
  }
  expect(await mockApiCalls()).toBe(calls);
  expect(calls).toBeGreaterThan(before);
});
