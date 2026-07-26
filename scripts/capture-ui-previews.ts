/**
 * Capture homepage and dashboard previews for release documentation.
 *
 * Usage (dev server must be running):
 *   npm run dev
 *   npx tsx scripts/capture-ui-previews.ts
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.SMOKE_BASE_URL?.trim() || "http://127.0.0.1:3000";
const OUT_DIR = join(process.cwd(), "public/marketing/previews");

const CAPTURES = [
  { name: "homepage", path: "/", width: 1440, height: 900, fullPage: true },
  { name: "dashboard", path: "/demo/dashboard", width: 1440, height: 900, fullPage: false },
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
    await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForTimeout(1500);
    const outPath = join(OUT_DIR, `${capture.name}.png`);
    await page.screenshot({
      path: outPath,
      type: "png",
      fullPage: capture.fullPage,
    });
    console.log(`  → ${outPath}`);
    await page.close();
  }

  await browser.close();
  console.log("\nDone. Previews saved to public/marketing/previews/");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
