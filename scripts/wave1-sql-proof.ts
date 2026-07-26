/**
 * Wave 1 SQL proof queries (RLS + grants). Requires DATABASE_URL in .env.local.
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

function resolveDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL?.trim() ?? "";
  if (direct) {
    return direct;
  }

  const password = process.env.SUPABASE_DB_PASSWORD?.trim() ?? "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!password || !supabaseUrl) {
    return "";
  }

  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) {
    return "";
  }

  const projectRef = match[1];
  const poolerRegion = process.env.SUPABASE_POOLER_REGION?.trim() || "eu-west-1";
  return `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-${poolerRegion}.pooler.supabase.com:6543/postgres`;
}

const databaseUrl = resolveDatabaseUrl();

const RLS_QUERY = `
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN (
  'security_audit_log',
  'stripe_webhook_events'
);
`;

const GRANTS_QUERY = `
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN (
  'security_audit_log',
  'stripe_webhook_events'
)
ORDER BY table_name, grantee;
`;

async function main() {
  if (!databaseUrl) {
    console.error(
      "DATABASE_URL (or SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL) is missing from .env.local. Add the Supabase postgres connection string to run SQL proof queries.",
    );
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    console.log("Wave 1 SQL proof\n");
    console.log("-- RLS enabled");
    console.log(RLS_QUERY.trim());
    const rls = await client.query(RLS_QUERY);
    console.table(rls.rows);

    console.log("\n-- Table grants");
    console.log(GRANTS_QUERY.trim());
    const grants = await client.query(GRANTS_QUERY);
    console.table(grants.rows);

    const tables = new Set(rls.rows.map((row) => String(row.relname)));
    const required = ["security_audit_log", "stripe_webhook_events"];
    const missing = required.filter((name) => !tables.has(name));
    const rlsOff = rls.rows.filter((row) => !row.relrowsecurity);

    const anonOrAuthGrants = grants.rows.filter((row) => {
      const grantee = String(row.grantee);
      return grantee === "anon" || grantee === "authenticated";
    });

    if (missing.length > 0) {
      console.error(`\nFAIL: Missing tables: ${missing.join(", ")}`);
      process.exit(1);
    }

    if (rlsOff.length > 0) {
      console.error(
        `\nFAIL: RLS not enabled on: ${rlsOff.map((row) => row.relname).join(", ")}`,
      );
      process.exit(1);
    }

    if (anonOrAuthGrants.length > 0) {
      console.error("\nFAIL: anon/authenticated still have table grants:");
      console.table(anonOrAuthGrants);
      process.exit(1);
    }

    console.log("\nSQL proof checks passed.");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("Wave 1 SQL proof crashed:", message);
  process.exit(1);
});
