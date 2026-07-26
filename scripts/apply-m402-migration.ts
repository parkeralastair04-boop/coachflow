import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const ROOT_DIR = process.cwd();
const MIGRATION_PATH =
  "supabase/migrations/20260610152000_confirmation_status_lookup.sql";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    process.env[key] = value;
  }
}

function resolveDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL?.trim() ?? "";
  if (direct) return direct;

  const password = process.env.SUPABASE_DB_PASSWORD?.trim() ?? "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!password || !supabaseUrl) return "";

  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) return "";

  const projectRef = match[1];
  const encodedPassword = encodeURIComponent(password);
  const poolerRegion = process.env.SUPABASE_POOLER_REGION?.trim() || "eu-west-1";
  return `postgresql://postgres.${projectRef}:${encodedPassword}@aws-0-${poolerRegion}.pooler.supabase.com:6543/postgres`;
}

async function main() {
  loadEnvFile(join(ROOT_DIR, ".env.local"));
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    console.error("FAIL: DATABASE_URL or SUPABASE_DB_PASSWORD is required.");
    process.exit(1);
  }

  const sql = readFileSync(join(ROOT_DIR, MIGRATION_PATH), "utf8");
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(sql);
    const { rows } = await client.query<{ proname: string }>(
      `select proname from pg_proc
       where proname in ('get_booking_confirmation_status', 'get_recurring_confirmation_status')`,
    );
    console.log(
      `OK: applied ${MIGRATION_PATH}. Functions: ${rows.map((r) => r.proname).join(", ")}`,
    );
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
