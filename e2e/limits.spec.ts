import { expect, test } from "@playwright/test";
import {
  advanceMock,
  createAtMock,
  registerAtMock,
  resetMock,
  setMockLimits,
  signIn,
  snapshot,
  tokenFromMock,
} from "./helpers";

const USERNAME = "limits-user";
const PASSWORD = "Sup3r$ecret!";

test.beforeEach(resetMock);

test("the home page's counts read properly at one", async ({ page }, testInfo) => {
  await setMockLimits({ idle_minutes: 1, max_awake_servers: 1, archive_after_days: 1, backup_retention_days: 1 });
  await page.goto("/");
  const limits = page.getByTestId("limits");
  await expect(limits).toContainText("1 server");
  await expect(limits.getByText("1 day", { exact: true })).toHaveCount(2);
  await expect(page.getByText("After 1 minute with nobody online")).toBeVisible();
  await expect(page.getByText("Up to 1 server can be awake at once")).toBeVisible();
  await expect(page.getByText("A server nobody has woken for 1 day is archived")).toBeVisible();
  await snapshot(page, testInfo, "home-limits-of-one");
});

test("a cap above one reads as servers on the home page and the server list", async ({ page }, testInfo) => {
  await setMockLimits({ servers_per_tenant: 2 });
  await page.goto("/");
  await expect(page.getByTestId("limits")).toContainText("2 servers");

  await registerAtMock(USERNAME, PASSWORD);
  const token = await tokenFromMock(USERNAME, PASSWORD);
  await createAtMock(token, "first-server");
  await advanceMock("first-server");
  await advanceMock("first-server");
  await createAtMock(token, "second-server");
  await signIn(page, USERNAME, PASSWORD);
  await expect(page.getByText("The free tier allows 2 servers per account.")).toBeVisible();
  await snapshot(page, testInfo, "servers-cap-of-two");
});
