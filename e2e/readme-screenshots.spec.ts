import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createAtMock, registerAtMock, resetMock, setMockState, setMockThumbnails, signIn, tokenFromMock } from "./helpers";

// Regenerates the README's screenshots of a server card with its world thumbnail
// (RFC 0034), against the mock, with made-up names and the mock's fixture picture
// (the exporter's committed fixture world). Skipped unless asked for:
//
//   npm run build && README_SCREENSHOTS=1 npx playwright test e2e/readme-screenshots.spec.ts
//
// writes docs/images/server-card-thumbnail-{desktop,phone}.png.
const OUT = path.join(__dirname, "..", "docs", "images");
const SERVER = "demo-world";
const USER = "demo-owner";
const PASSWORD = "Demo-owner1!";

test.skip(!process.env.README_SCREENSHOTS, "set README_SCREENSHOTS=1 to regenerate the README screenshots");

test("server card with its world thumbnail", async ({ page, isMobile }, testInfo) => {
  await resetMock();
  await registerAtMock(USER, PASSWORD);
  await createAtMock(await tokenFromMock(USER, PASSWORD), SERVER);
  await setMockState(SERVER, "asleep", null);
  await setMockThumbnails("manual");
  await signIn(page, USER, PASSWORD);

  // Draw the picture the way an owner does, on the server's page.
  await page.goto(`/servers/${SERVER}`);
  const section = page.getByTestId("thumbnail-section");
  const refresh = section.getByTestId("thumbnail-refresh");
  if (isMobile) await refresh.tap();
  else await refresh.click();
  await expect(section).toHaveAttribute("data-status", "ready", { timeout: 20_000 });

  await page.goto("/servers");
  const img = page.getByTestId("server-card").getByTestId("thumbnail-img");
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(200);
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `server-card-thumbnail-${testInfo.project.name}.png`) });
});
