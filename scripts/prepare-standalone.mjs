// `next build` with output: "standalone" leaves the static assets and the
// public folder outside .next/standalone (the Dockerfile copies them in).
// This does the same copy for local runs and CI, so the smoke test exercises
// exactly what the container ships.
import { cpSync, existsSync, mkdirSync } from "node:fs";

const standalone = ".next/standalone";
if (!existsSync(`${standalone}/server.js`)) {
  console.error("No standalone build found; run `npm run build` first.");
  process.exit(1);
}
mkdirSync(`${standalone}/.next`, { recursive: true });
cpSync(".next/static", `${standalone}/.next/static`, { recursive: true });
if (existsSync("public")) cpSync("public", `${standalone}/public`, { recursive: true });
console.log("standalone build prepared");
