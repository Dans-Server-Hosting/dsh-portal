import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { mockApiCalls, resetMock } from "./helpers";

test.beforeEach(resetMock);

test("/api/health answers with no session and without calling dsh-api", async ({ request }) => {
  const before = await mockApiCalls();
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
  expect(await mockApiCalls()).toBe(before);

  // The count does move for a page that does ask dsh-api, which is why a probe must not use one.
  await request.get("/");
  expect(await mockApiCalls()).toBeGreaterThan(before);
});

test("the Deployment's probes use /api/health", () => {
  const manifest = readFileSync(path.join(__dirname, "..", "deploy", "deployment.yaml"), "utf8");
  const probePaths = [...manifest.matchAll(/^\s+path: (\S+)$/gm)].map((match) => match[1]);
  expect(probePaths).toEqual(["/api/health", "/api/health"]);
});
