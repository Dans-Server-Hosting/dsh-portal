import { expect, test } from "@playwright/test";
import { MOCK_URL } from "../playwright.config";
import { registerAtMock, resetMock, signIn, snapshot, tokenFromMock } from "./helpers";

const USER = "feedback-user";
const ADMIN = "admin";
const PASSWORD = "Fe3dback-test!";
const MESSAGE = "The wake button is easy to miss on my phone.\nA bigger one would help.";

test.beforeEach(async () => {
  await resetMock();
  await registerAtMock(USER, PASSWORD);
  await registerAtMock(ADMIN, PASSWORD);
});

test("a user sends feedback and an admin reads it", async ({ page }, testInfo) => {
  // ---- a normal user: the Feedback link is there, the admin link is not ----
  await signIn(page, USER, PASSWORD);
  const feedbackLink = page.getByTestId("feedback-link");
  await expect(feedbackLink).toHaveAttribute("href", "/feedback?from=%2Fservers");
  await expect(page.getByTestId("admin-feedback-link")).toHaveCount(0);

  // ---- the form: counter, empty message refused locally, page carried along ----
  await feedbackLink.click();
  await expect(page).toHaveURL(/\/feedback\?from=%2Fservers$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Feedback");
  await expect(page.getByTestId("feedback-page")).toContainText("/servers");
  await expect(page.getByTestId("feedback-counter")).toHaveText("0 / 4000");
  await page.getByTestId("feedback-submit").click();
  await expect(page.getByText("Write something first.")).toBeVisible();
  await page.getByTestId("feedback-input").fill(MESSAGE);
  await expect(page.getByTestId("feedback-counter")).toHaveText(`${MESSAGE.length} / 4000`);
  await snapshot(page, testInfo, "feedback");

  // ---- submit: the thanks, and the API has it with the page attached ----
  await page.getByTestId("feedback-submit").click();
  const sent = page.getByTestId("feedback-sent");
  await expect(sent).toBeVisible();
  await expect(sent).toContainText("Thank you");
  await expect(page.getByTestId("feedback-back")).toHaveAttribute("href", "/servers");
  await snapshot(page, testInfo, "feedback-sent");
  const adminToken = await tokenFromMock(ADMIN, PASSWORD);
  const stored = (await (await fetch(`${MOCK_URL}/api/v1/feedback?status=new`, { headers: { authorization: `Bearer ${adminToken}` } })).json()) as Array<{
    username: string;
    message: string;
    page: string | null;
    status: string;
  }>;
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ username: USER, message: MESSAGE, page: "/servers", status: "new" });

  // ---- the rate limit is shown plainly once the API says 429 ----
  const userToken = await tokenFromMock(USER, PASSWORD);
  for (let i = 0; i < 9; i++) {
    const response = await fetch(`${MOCK_URL}/api/v1/feedback`, {
      method: "POST",
      headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
      body: JSON.stringify({ message: `filler ${i}` }),
    });
    expect(response.status).toBe(201);
  }
  await page.getByRole("button", { name: "Send more" }).click();
  await page.getByTestId("feedback-input").fill("One more thing.");
  await page.getByTestId("feedback-submit").click();
  await expect(page.getByTestId("feedback-error")).toContainText("a lot of feedback in the last hour");

  // ---- a normal user cannot see the admin area, in the UI or through the proxy ----
  await page.goto("/admin/feedback");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Not found");
  await expect(page.getByTestId("feedback-item")).toHaveCount(0);
  const proxied = await page.request.get("/api/feedback?status=all");
  expect(proxied.status()).toBe(403);
  const patched = await page.request.patch("/api/feedback/1", { data: { status: "read" } });
  expect(patched.status()).toBe(403);

  // ---- the admin: the header link appears, the list shows what was sent ----
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await signIn(page, ADMIN, PASSWORD);
  const adminLink = page.getByTestId("admin-feedback-link");
  await expect(adminLink).toHaveAttribute("href", "/admin/feedback");
  await adminLink.click();
  await expect(page).toHaveURL(/\/admin\/feedback$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Feedback");
  const items = page.getByTestId("feedback-item");
  await expect(items).toHaveCount(10);
  const item = items.filter({ hasText: "wake button" });
  await expect(item).toHaveAttribute("data-status", "new");
  await expect(item.getByTestId("feedback-username")).toHaveText(USER);
  await expect(item.getByTestId("feedback-item-page")).toContainText("/servers");
  await expect(item.getByTestId("feedback-when")).toHaveText("just now");
  await expect(item.getByTestId("feedback-message")).toHaveText(MESSAGE);
  // Newest first: the last filler is at the top, the real message at the bottom.
  await expect(items.first().getByTestId("feedback-message")).toHaveText("filler 8");
  await expect(items.last().getByTestId("feedback-message")).toHaveText(MESSAGE);
  await snapshot(page, testInfo, "admin-feedback");

  // ---- mark read, and back to new, without leaving the page ----
  await item.getByTestId("mark-read").click();
  await expect(item).toHaveAttribute("data-status", "read");
  await expect(item.getByTestId("mark-new")).toBeVisible();
  const afterRead = (await (await fetch(`${MOCK_URL}/api/v1/feedback?status=read`, { headers: { authorization: `Bearer ${adminToken}` } })).json()) as Array<{
    message: string;
  }>;
  expect(afterRead.map((f) => f.message)).toEqual([MESSAGE]);

  // ---- the filter: Read shows it, New no longer does ----
  await page.getByTestId("filter-read").click();
  await expect(page).toHaveURL(/\/admin\/feedback\?status=read$/);
  await expect(items).toHaveCount(1);
  await expect(items.first()).toHaveAttribute("data-status", "read");
  await snapshot(page, testInfo, "admin-feedback-read");
  await items.first().getByTestId("mark-new").click();
  await expect(items.first()).toHaveAttribute("data-status", "new");
  await page.getByTestId("filter-all").click();
  await expect(page).toHaveURL(/\/admin\/feedback\?status=all$/);
  await expect(items).toHaveCount(10);
  await page.getByTestId("filter-new").click();
  await expect(items).toHaveCount(10);
});

test("the admin list is empty until someone writes in", async ({ page }, testInfo) => {
  await signIn(page, ADMIN, PASSWORD);
  await page.goto("/admin/feedback");
  await expect(page.getByTestId("feedback-empty")).toContainText("Nothing new");
  await snapshot(page, testInfo, "admin-feedback-empty");
});

test("the feedback page itself needs a sign-in", async ({ page }) => {
  await page.goto("/feedback");
  await expect(page).toHaveURL(/\/auth\/login$/);
});

test("the feedback proxies need sign-in; their own checks run first", async ({ page }) => {
  expect((await page.request.post("/api/feedback", { data: { message: MESSAGE, page: "/servers" } })).status()).toBe(401);
  expect((await page.request.get("/api/feedback?status=all")).status()).toBe(401);
  expect((await page.request.patch("/api/feedback/1", { data: { status: "read" } })).status()).toBe(401);
  // The filter, the id and the body are checked before the session, so these 400s are the portal's, not the API's.
  expect((await page.request.get("/api/feedback?status=everything")).status()).toBe(400);
  expect((await page.request.patch("/api/feedback/one", { data: { status: "read" } })).status()).toBe(400);
  // Ids that Number() would read as another item (1, or a rounded 2^53) are not ids either.
  for (const id of ["0x1", "1e0", "1.0", "%201", "-1", "9007199254740993"]) {
    expect((await page.request.patch(`/api/feedback/${id}`, { data: { status: "read" } })).status(), id).toBe(400);
  }
  expect((await page.request.patch("/api/feedback/1", { data: { status: "done" } })).status()).toBe(400);
  const notJson = { data: "not json", headers: { "content-type": "text/plain" } };
  expect((await page.request.post("/api/feedback", notJson)).status()).toBe(400);
  expect((await page.request.patch("/api/feedback/1", notJson)).status()).toBe(400);

  // Nothing signed out reached the API: the admin's list is still empty.
  await signIn(page, ADMIN, PASSWORD);
  const all = await page.request.get("/api/feedback?status=all");
  expect(all.status()).toBe(200);
  expect(await all.json()).toEqual([]);
});

test("the feedback proxies answer a body that is not a JSON object with their own 400", async ({ page }) => {
  for (const data of ["null", "[]", "5"]) {
    const options = { data, headers: { "content-type": "application/json" } };
    const sent = await page.request.post("/api/feedback", options);
    expect(sent.status(), data).toBe(400);
    expect(await sent.json(), data).toEqual({ message: "The request body must be JSON." });
    const patched = await page.request.patch("/api/feedback/1", options);
    expect(patched.status(), data).toBe(400);
    expect(await patched.json(), data).toEqual({ message: "The request body must be JSON." });
  }
});

test("the feedback proxy treats a message that is not a string as empty", async ({ page }) => {
  await signIn(page, USER, PASSWORD);
  for (const message of [{}, [], 5, true]) {
    const response = await page.request.post("/api/feedback", { data: { message } });
    expect(response.status(), JSON.stringify(message)).toBe(422);
  }

  // Nothing was stored: the admin's list is still empty.
  const adminToken = await tokenFromMock(ADMIN, PASSWORD);
  const stored = await fetch(`${MOCK_URL}/api/v1/feedback?status=all`, { headers: { authorization: `Bearer ${adminToken}` } });
  expect(await stored.json()).toEqual([]);
});

// The form only ever sends a portal path, so these go to the proxy directly: it
// keeps `page` only when it is a path on the portal (a leading single slash, at
// most 200 characters). The mock would keep any string and cut it at 200, so a
// null here is the proxy's doing.
test("the feedback proxy keeps only a portal path as the page", async ({ page }) => {
  await signIn(page, USER, PASSWORD);
  const send = async (data: unknown) => {
    const response = await page.request.post("/api/feedback", { data });
    expect(response.status()).toBe(201);
    return (await response.json()) as { message: string; page: string | null };
  };
  expect(await send({ message: "on-site", page: "/servers" })).toMatchObject({ message: "on-site", page: "/servers" });
  expect((await send({ message: "off-site", page: "https://example.com/servers" })).page).toBeNull();
  expect((await send({ message: "protocol-relative", page: "//example.com/servers" })).page).toBeNull();
  expect((await send({ message: "too long", page: `/${"a".repeat(200)}` })).page).toBeNull();
  const longest = `/${"a".repeat(199)}`;
  expect((await send({ message: "longest kept", page: longest })).page).toBe(longest);
});
