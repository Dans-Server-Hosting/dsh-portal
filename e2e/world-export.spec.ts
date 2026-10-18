import { devices, expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import {
  createAtMock,
  registerAtMock,
  resetMock,
  setMockState,
  setMockWorldExport,
  signIn,
  snapshot,
  tokenFromMock,
} from "./helpers";

// RFC 0021: export a box of the world as 3D, preview it, download the zip.
const SERVER = "export-test";
const USER = "export-user";
const PASSWORD = "Exp0rt-test!";
const SHOTS = process.env.EXPORT_SHOTS_DIR;

type Hook = { ready: boolean; tiles: number; errors: string[]; frames: number };

test.beforeEach(async () => {
  await resetMock();
  await registerAtMock(USER, PASSWORD);
  await createAtMock(await tokenFromMock(USER, PASSWORD), SERVER);
  await setMockState(SERVER, "asleep", null);
});

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function viewerHook(page: Page): Promise<Hook | null> {
  return page.evaluate(() => (window as unknown as { __dshExportViewer?: Hook }).__dshExportViewer ?? null);
}

async function exportUntilReady(page: Page) {
  const section = page.getByTestId("export-section");
  await section.getByTestId("export-start").click();
  const item = section.getByTestId("export-item").first();
  await expect(item.getByTestId("export-progress")).toHaveText(/Queued|Starting|Copying world|Building 3D/);
  await expect(section.getByTestId("export-start")).toBeDisabled();
  await expect(item).toHaveAttribute("data-status", "ready", { timeout: 20_000 });
  return item;
}

async function openPreview(page: Page, item: ReturnType<Page["getByTestId"]>, tap: boolean) {
  const button = item.getByTestId("export-preview");
  if (tap) await button.tap();
  else await button.click();
  await expect(page.getByTestId("export-viewer-canvas")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  const hook = await viewerHook(page);
  expect(hook?.ready).toBe(true);
  expect(hook?.tiles).toBeGreaterThan(0);
  expect(hook?.errors).toEqual([]);
}

test("the section is not shown while world export is switched off", async ({ page }) => {
  await setMockWorldExport(false);
  await signIn(page, USER, PASSWORD);
  await page.goto(`/servers/${SERVER}`);
  await expect(page.getByTestId("state-description")).toBeVisible();
  await expect(page.getByTestId("export-section")).toHaveCount(0);
});

test("export, preview, download and delete", async ({ page }, testInfo) => {
  await setMockWorldExport(true);
  await signIn(page, USER, PASSWORD);
  await page.goto(`/servers/${SERVER}`);
  const section = page.getByTestId("export-section");
  await expect(section.getByTestId("export-default-area")).toHaveText("256 × 256 blocks around spawn, every height.");

  const item = await exportUntilReady(page);
  await expect(item.getByTestId("export-snapshot")).toHaveText("Exact copy (server was asleep)");
  await expect(item.getByTestId("export-stats")).toContainText("1,069,183 blocks");
  await expect(item.getByTestId("export-stats")).toContainText("8.7 MB zip");
  await snapshot(page, testInfo, "export-ready");
  await shot(page, `portal-${testInfo.project.name}-export-ready`);

  // ---- the 3D preview draws the real usd-web tiles ----
  await openPreview(page, item, false);
  await shot(page, `portal-${testInfo.project.name}-preview`);
  await page.getByTestId("export-preview-close").click();
  await expect(page.getByTestId("export-viewer-canvas")).toHaveCount(0);

  // ---- the download follows the signed link, no session needed ----
  const downloading = page.waitForEvent("download");
  await item.getByTestId("export-download").click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^export-test-world-[0-9a-f]+\.zip$/);

  // ---- delete ----
  await item.getByTestId("export-delete").click();
  await page.getByTestId("export-delete-confirm").click();
  await expect(section.getByTestId("export-item")).toHaveCount(0);
});

test("a live copy that kept changing says so, and a failure says why", async ({ page }) => {
  await setMockWorldExport(true, { snapshot: "live_changing" });
  await signIn(page, USER, PASSWORD);
  await page.goto(`/servers/${SERVER}`);
  const item = await exportUntilReady(page);
  await expect(item.getByTestId("export-snapshot")).toContainText("a few chunks may be missing or out of date");

  await setMockWorldExport(true, { error: "the area was too large to export; try a smaller one" });
  await page.getByTestId("export-start").click();
  const failed = page.getByTestId("export-item").first();
  await expect(failed).toHaveAttribute("data-status", "failed", { timeout: 20_000 });
  await expect(failed.getByTestId("export-progress")).toHaveText("Failed");
  await expect(failed.getByTestId("export-failure")).toHaveText("the area was too large to export; try a smaller one");
});

test("a chosen area is checked before it is sent", async ({ page }) => {
  await setMockWorldExport(true);
  await signIn(page, USER, PASSWORD);
  await page.goto(`/servers/${SERVER}`);
  const section = page.getByTestId("export-section");
  await section.getByTestId("export-choose-area").click();
  await page.getByTestId("export-x1").fill("0");
  await page.getByTestId("export-z1").fill("0");
  await page.getByTestId("export-x2").fill("600");
  await page.getByTestId("export-z2").fill("100");
  await expect(page.getByTestId("export-area-problem")).toHaveText("The area can be at most 512 × 512 blocks.");
  await expect(section.getByTestId("export-start")).toBeDisabled();
  await page.getByTestId("export-x2").fill("99");
  await expect(page.getByTestId("export-area-problem")).toHaveCount(0);
  await section.getByTestId("export-start").click();
  const item = section.getByTestId("export-item").first();
  await expect(item).toHaveAttribute("data-status", "ready", { timeout: 20_000 });
  await expect(item).toContainText("100 × 101 blocks, X 0…99, Z 0…100");
});

test("the daily limit is explained with the time to wait", async ({ page }) => {
  await setMockWorldExport(true);
  const token = await tokenFromMock(USER, PASSWORD);
  // Five exports today, each finished before the next (one at a time per server).
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`http://127.0.0.1:4000/api/v1/servers/${SERVER}/exports`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
    });
    expect(r.status).toBe(202);
    await expect
      .poll(async () => {
        const list = await fetch(`http://127.0.0.1:4000/api/v1/servers/${SERVER}/exports`, {
          headers: { authorization: `Bearer ${token}` },
        }).then((x) => x.json());
        return list.exports[0].status;
      }, { timeout: 20_000 })
      .toBe("ready");
  }
  await signIn(page, USER, PASSWORD);
  await page.goto(`/servers/${SERVER}`);
  await page.getByTestId("export-start").click();
  await expect(page.getByTestId("export-error")).toHaveText(
    /Your account has used its exports for today\. Try again in \d+ hours?\./,
  );
});

test.describe("on an iPhone", () => {
  // The iPhone preset asks for WebKit; the suite runs Chromium, with the iPhone's size, touch and pixel ratio.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { defaultBrowserType, ...iphone } = devices["iPhone 13"];
  test.use(iphone);

  test("the preview opens full screen with taps and the viewer draws", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "one run is enough");
    await setMockWorldExport(true);
    await signIn(page, USER, PASSWORD);
    await page.goto(`/servers/${SERVER}`);
    await page.getByTestId("export-start").tap();
    const item = page.getByTestId("export-item").first();
    await expect(item).toHaveAttribute("data-status", "ready", { timeout: 20_000 });
    await item.scrollIntoViewIfNeeded();
    await shot(page, "portal-iphone-export-ready");
    await openPreview(page, item, true);
    // Full screen: the dialog fills the viewport.
    const box = await page.getByRole("dialog").boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && Math.round(box.width)).toBe(viewport?.width);
    // A one-finger drag on the canvas turns the view (the viewer draws another frame).
    const before = (await viewerHook(page))?.frames ?? 0;
    const canvas = page.getByTestId("export-viewer-canvas");
    const cb = await canvas.boundingBox();
    if (cb) {
      const cdp = await page.context().newCDPSession(page);
      const x = cb.x + cb.width / 2;
      const y = cb.y + cb.height / 2;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (let i = 1; i <= 5; i++) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + i * 20, y }] });
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    await expect.poll(async () => (await viewerHook(page))?.frames ?? 0).toBeGreaterThan(before);
    await shot(page, "portal-iphone-preview");
    // Chromium drops a tap that lands within moments of a synthetic touch gesture
    // ending, so the close is retried until it takes (a person never taps that fast).
    await expect(async () => {
      await page.getByTestId("export-preview-close").tap({ timeout: 2_000 });
      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
  });
});
