/**
 * Capture real Awarix UI screenshots from demo routes for the marketing homepage.
 *
 * Usage (dev server must be running on SMOKE_BASE_URL):
 *   npm run dev
 *   npm run capture:marketing-screenshots
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_BASE_URL?.trim() || "http://127.0.0.1:3000";
const OUT_DIR = join(process.cwd(), "public/marketing/screenshots");

const CAPTURES = [
  { name: "hero-dashboard", path: "/demo/dashboard", width: 1280, height: 900 },
  { name: "players", path: "/demo/dashboard/players", width: 1280, height: 900 },
  { name: "sessions", path: "/demo/dashboard/sessions", width: 1280, height: 900 },
  { name: "bookings", path: "/demo/dashboard/bookings", width: 1280, height: 900 },
  { name: "family", path: "/demo/dashboard/family", width: 1280, height: 900 },
  { name: "reports", path: "/demo/dashboard/reports", width: 1280, height: 900 },
  { name: "analytics", path: "/demo/dashboard/analytics", width: 1280, height: 900 },
] as const;

async function main() {
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });

  for (const capture of CAPTURES) {
    const page = await context.newPage();
    await page.setViewportSize({ width: capture.width, height: capture.height });
    const url = `${BASE_URL}${capture.path}`;
    console.log(`Capturing ${url}…`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector("h1", { timeout: 30_000 });
    await page.waitForTimeout(1200);
    const outPath = join(OUT_DIR, `${capture.name}.png`);
    await page.screenshot({ path: outPath, type: "png", fullPage: false });
    console.log(`  → ${outPath}`);
    await page.close();
  }

  await browser.close();
  console.log("\nDone. Screenshots saved to public/marketing/screenshots/");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
