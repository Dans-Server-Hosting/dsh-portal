import { defineConfig, devices } from "@playwright/test";

// The smoke test runs the production build against the in-memory mock of
// dsh-api + UserAuth in mock/server.mjs. `npm run build` must have run first.
const MOCK_PORT = 4000;
const PORTAL_PORT = 3000;
export const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}`;
const PORTAL_URL = `http://localhost:${PORTAL_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // The mock holds one tenant with a one-server cap, so tests run one at a time.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: PORTAL_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    {
      name: "phone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 400, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
  ],
  webServer: [
    {
      command: "node mock/server.mjs",
      url: `${MOCK_URL}/api/v1/limits`,
      reuseExistingServer: !process.env.CI,
      // Provisioning is driven by the tests (POST /mock/servers/{name}/advance),
      // so it must not move on its own while a step is being looked at.
      env: { MOCK_PORT: String(MOCK_PORT), MOCK_WAKE_MS: "2000", MOCK_PROVISION_MS: "600000" },
    },
    {
      // The standalone server is what the Dockerfile ships, so it is what is tested.
      command: "npm run start:standalone",
      url: PORTAL_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        PORT: String(PORTAL_PORT),
        HOSTNAME: "127.0.0.1",
        DSH_API_URL: MOCK_URL,
        USERAUTH_URL: `${MOCK_URL}/userauth`,
        PORTAL_URL,
      },
    },
  ],
});
