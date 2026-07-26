/**
 * Apply Wave 1 migrations (M1 + M2) via direct postgres. Requires DATABASE_URL.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const ROOT_DIR = process.cwd();

function loadEnvFile(path: string) {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(join(ROOT_DIR, ".env.local"));

const MIGRATIONS = [
  "supabase/migrations/20260610120000_security_audit_log.sql",
  "supabase/migrations/20260610130000_stripe_webhook_events.sql",
] as const;

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (!databaseUrl) {
    console.error("DATABASE_URL is missing from .env.local.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    for (const migrationPath of MIGRATIONS) {
      const sql = readFileSync(join(ROOT_DIR, migrationPath), "utf8");
      console.log(`Applying ${migrationPath}...`);
      await client.query(sql);
      console.log(`Applied ${migrationPath}`);
    }

    console.log("\nWave 1 migrations applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("Wave 1 migration apply failed:", message);
  process.exit(1);
});
