import { expect, test } from "@playwright/test";
import { createAtMock, registerAtMock, resetMock, setMockClusterError, setMockState, signIn, snapshot, tokenFromMock } from "./helpers";

const USER = "cluster-user";
const PASSWORD = "Clust3r-test!";
const SERVER = "cluster-test";
// The shape dsh-api's ClusterError handler sends: written to be shown as is.
const DETAIL = "cluster operation failed: kubectl run failed: timed out waiting for the condition";
const NOT_REACHABLE = "not reachable";

test.beforeEach(async () => {
  await resetMock();
  await registerAtMock(USER, PASSWORD);
  const token = await tokenFromMock(USER, PASSWORD);
  await createAtMock(token, SERVER);
  await setMockState(SERVER, "asleep", null);
});

test("a 502 from the API shows its detail, not 'not reachable'", async ({ page }, testInfo) => {
  await signIn(page, USER, PASSWORD);
  await setMockClusterError(SERVER, DETAIL);

  // ---- wake on the detail page: the API's own sentence, in the action alert ----
  await page.goto(`/servers/${SERVER}`);
  await expect(page.getByTestId("state-pill")).toHaveAttribute("data-state", "asleep");
  await page.getByTestId("wake-button").click();
  const wakeError = page.getByRole("alert").filter({ hasText: DETAIL });
  await expect(wakeError).toBeVisible();
  await expect(page.getByText(NOT_REACHABLE)).toHaveCount(0);
  await expect(page.getByTestId("state-pill")).toHaveAttribute("data-state", "asleep");
  await snapshot(page, testInfo, "server-detail-cluster-error");

  // ---- delete: the same sentence inside the dialog, and no players-online tick box ----
  await page.getByTestId("delete-button").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("delete-confirm-input").fill(SERVER);
  await dialog.getByTestId("delete-confirm-button").click();
  await expect(dialog.getByRole("alert")).toContainText(DETAIL);
  await expect(dialog.getByText(NOT_REACHABLE)).toHaveCount(0);
  await expect(dialog.getByTestId("delete-force")).toHaveCount(0);
  await expect(dialog.getByTestId("delete-confirm-button")).toBeEnabled();
  await expect(page.locator(".MuiDialog-container")).toHaveCSS("opacity", "1");
  await snapshot(page, testInfo, "delete-dialog-cluster-error");

  // ---- once the API recovers, the same button works ----
  await setMockClusterError(SERVER, null);
  await dialog.getByTestId("delete-confirm-button").click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/servers\?deleted=/);
  await expect(page.getByTestId("empty-state")).toBeVisible();

  // ---- the list card goes through the same path ----
  const token = await tokenFromMock(USER, PASSWORD);
  await createAtMock(token, SERVER);
  await setMockState(SERVER, "asleep", null);
  await setMockClusterError(SERVER, DETAIL);
  await page.goto("/servers");
  const card = page.getByTestId("server-card").filter({ hasText: SERVER });
  await card.getByTestId("wake-button").click();
  await expect(page.getByRole("alert").filter({ hasText: DETAIL })).toBeVisible();
  await expect(page.getByText(NOT_REACHABLE)).toHaveCount(0);
});
