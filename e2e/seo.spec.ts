import { expect, test, type Page } from "@playwright/test";
import { resetMock } from "./helpers";

// The smoke test serves the portal on localhost, so these checks also prove
// that no absolute URL is derived from the request or PORTAL_URL.
const ORIGIN = "https://dansserverhosting.com";

test.beforeEach(resetMock);

async function meta(page: Page, attr: "name" | "property", key: string) {
  return page.locator(`meta[${attr}="${key}"]`).getAttribute("content");
}

for (const [path, url, title] of [
  ["/", `${ORIGIN}`, "Dan's Server Hosting"],
  ["/auth/login", `${ORIGIN}/auth/login`, "Sign in · Dan's Server Hosting"],
  ["/auth/register", `${ORIGIN}/auth/register`, "Create an account · Dan's Server Hosting"],
] as const) {
  test(`${path} has a canonical link and share tags on the production origin`, async ({ page }) => {
    await page.goto(path);
    // Next.js writes the root as the bare origin (no trailing slash); both are the same URL.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", url);
    expect(await meta(page, "property", "og:url")).toBe(url);
    expect(await meta(page, "property", "og:title")).toBe(title);
    expect(await meta(page, "property", "og:site_name")).toBe("Dan's Server Hosting");
    expect(await meta(page, "property", "og:type")).toBe("website");
    expect(await meta(page, "property", "og:description")).toBeTruthy();
    expect(await meta(page, "name", "description")).toBeTruthy();
    expect(await meta(page, "name", "twitter:card")).toBe("summary_large_image");
    expect(await meta(page, "name", "twitter:title")).toBe(title);
    expect(await meta(page, "property", "og:image")).toBe(`${ORIGIN}/og.png`);
    expect(await meta(page, "property", "og:image:type")).toBe("image/png");
    expect(await meta(page, "property", "og:image:width")).toBe("1200");
    expect(await meta(page, "property", "og:image:height")).toBe("630");
    expect(await meta(page, "property", "og:image:alt")).toContain("Dan's Server Hosting");
    expect(await meta(page, "name", "twitter:image")).toBe(`${ORIGIN}/og.png`);
    expect(await meta(page, "name", "twitter:image:alt")).toContain("Dan's Server Hosting");
    const html = await page.content();
    expect(html).not.toContain("localhost");
    expect(html).not.toContain("127.0.0.1");
  });
}

test("the share image is served as a 1200x630 PNG", async ({ request }) => {
  const response = await request.get("/og.png");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toBe("image/png");
  const body = await response.body();
  expect(body.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  // The IHDR chunk follows the signature: width and height are big-endian at bytes 16 and 20.
  expect([body.readUInt32BE(16), body.readUInt32BE(20)]).toEqual([1200, 630]);
});

test("robots.txt allows the public pages and points at the sitemap", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.ok()).toBeTruthy();
  const body = await response.text();
  expect(body).toContain("User-Agent: *");
  expect(body).toContain("Allow: /");
  expect(body).toContain("Disallow: /servers");
  expect(body).toContain("Disallow: /api/");
  expect(body).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
});

test("sitemap.xml lists exactly the public pages on the production origin", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBeTruthy();
  const body = await response.text();
  const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs).toEqual([`${ORIGIN}/`, `${ORIGIN}/auth/login`, `${ORIGIN}/auth/register`]);
});
