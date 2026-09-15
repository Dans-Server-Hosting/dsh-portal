import { expect, test, type Page } from "@playwright/test";
import { resetMock, snapshot } from "./helpers";

test.beforeEach(resetMock);

/** What the page is actually painted on, so a wrong attribute can't pass on its own. */
async function bodyBackground(page: Page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

/** MUI marks the active scheme as `<html data-dark>` or `<html data-light>`. */
async function expectScheme(page: Page, scheme: "dark" | "light") {
  const other = scheme === "dark" ? "light" : "dark";
  await expect(page.locator("html")).toHaveAttribute(`data-${scheme}`, "");
  await expect(page.locator("html")).not.toHaveAttribute(`data-${other}`, /.*/);
}

test("dark by default, light on request, and the choice survives a reload", async ({ page }, testInfo) => {
  // ---- a first visit, nothing stored: dark, even though the browser prefers light ----
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expectScheme(page, "dark");
  expect(await bodyBackground(page)).toBe("rgb(17, 20, 18)");
  const toggle = page.getByTestId("theme-toggle");
  await expect(toggle).toHaveAttribute("data-mode", "dark");
  await expect(toggle).toHaveAccessibleName("Switch to light mode");
  await snapshot(page, testInfo, "landing-dark");

  // ---- the toggle switches to light straight away ----
  await toggle.click();
  await expectScheme(page, "light");
  expect(await bodyBackground(page)).toBe("rgb(246, 247, 244)");
  await expect(toggle).toHaveAttribute("data-mode", "light");
  await expect(toggle).toHaveAccessibleName("Switch to dark mode");
  await snapshot(page, testInfo, "landing-light");

  // ---- the choice is kept, and applied before React runs so there is no dark flash ----
  await page.goto("/auth/login");
  const atLoad = await page.evaluate(() => document.documentElement.hasAttribute("data-light"));
  expect(atLoad, "the attribute is set by the inline script, not after hydration").toBe(true);
  expect(await bodyBackground(page)).toBe("rgb(246, 247, 244)");
  await expect(page.getByTestId("theme-toggle")).toHaveAttribute("data-mode", "light");
  await snapshot(page, testInfo, "login-light");

  // ---- and back to dark ----
  await page.getByTestId("theme-toggle").click();
  await expectScheme(page, "dark");
  await page.reload();
  await expectScheme(page, "dark");
  expect(await bodyBackground(page)).toBe("rgb(17, 20, 18)");
});
