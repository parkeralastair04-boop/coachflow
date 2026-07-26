/**
 * M4-03/M4-04: grant verification + attack tests for payment-integrity lockdown.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const ROOT_DIR = process.cwd();

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    process.env[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
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

type GrantRow = {
  routine_name: string;
  grantee: string;
  privilege_type: string;
};

const MUTATION_RPCS = [
  "confirm_public_session_booking",
  "confirm_public_recurring_enrolment",
  "sync_recurring_subscription_state",
] as const;

async function verifyGrants(client: pg.Client) {
  const { rows } = await client.query<GrantRow>(
    `select routine_name, grantee, privilege_type
     from information_schema.routine_privileges
     where routine_schema = 'public'
       and routine_name = any($1::text[])
       and privilege_type = 'EXECUTE'
     order by routine_name, grantee`,
    [MUTATION_RPCS],
  );

  console.log("\n=== Grant verification ===");
  for (const rpc of MUTATION_RPCS) {
    const grants = rows.filter((r) => r.routine_name === rpc);
    const grantees = grants.map((g) => g.grantee);
    const anon = grantees.includes("anon");
    const authenticated = grantees.includes("authenticated");
    const serviceRole = grantees.includes("service_role");
    const publicRole = grantees.includes("PUBLIC") || grantees.includes("public");

    console.log(`\n${rpc}:`);
    console.log(`  grantees: ${grantees.join(", ") || "(none)"}`);
    console.log(`  anon: ${anon ? "YES (unexpected)" : "NO"}`);
    console.log(`  authenticated: ${authenticated ? "YES (unexpected)" : "NO"}`);
    console.log(`  service_role: ${serviceRole ? "YES" : "NO (unexpected)"}`);
    console.log(`  public: ${publicRole ? "YES (unexpected)" : "NO"}`);

    if (anon || authenticated || publicRole || !serviceRole) {
      throw new Error(`Grant verification failed for ${rpc}`);
    }
  }
  console.log("\nAll grant checks passed.");
}

async function runAttackTests() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const fakeUuid = "00000000-0000-0000-0000-000000000001";

  console.log("\n=== Attack tests (anon key) ===");

  const session = await anon.rpc("confirm_public_session_booking", {
    p_booking_id: fakeUuid,
    p_stripe_checkout_session_id: "fake_checkout",
    p_stripe_payment_intent_id: "fake_payment_intent",
  });
  const sessionDenied =
    Boolean(session.error) &&
    (session.error.message.toLowerCase().includes("permission") ||
      session.error.code === "42501" ||
      session.error.code === "PGRST301");
  console.log(
    `confirm_public_session_booking: ${sessionDenied ? "PASS (denied)" : `FAIL: ${session.error?.message ?? "unexpected success"}`}`,
  );
  if (!sessionDenied) throw new Error("Attack test failed: confirm_public_session_booking");

  const enrolment = await anon.rpc("confirm_public_recurring_enrolment", {
    p_enrolment_id: fakeUuid,
    p_stripe_customer_id: "cus_fake",
    p_stripe_subscription_id: "sub_fake",
    p_subscription_status: "active",
    p_current_period_end: new Date().toISOString(),
  });
  const enrolmentDenied =
    Boolean(enrolment.error) &&
    (enrolment.error.message.toLowerCase().includes("permission") ||
      enrolment.error.code === "42501" ||
      enrolment.error.code === "PGRST301");
  console.log(
    `confirm_public_recurring_enrolment: ${enrolmentDenied ? "PASS (denied)" : `FAIL: ${enrolment.error?.message ?? "unexpected success"}`}`,
  );
  if (!enrolmentDenied) throw new Error("Attack test failed: confirm_public_recurring_enrolment");

  const sync = await anon.rpc("sync_recurring_subscription_state", {
    p_stripe_subscription_id: "sub_fake",
    p_status: "active",
    p_current_period_end: new Date().toISOString(),
  });
  const syncDenied =
    Boolean(sync.error) &&
    (sync.error.message.toLowerCase().includes("permission") ||
      sync.error.code === "42501" ||
      sync.error.code === "PGRST301");
  console.log(
    `sync_recurring_subscription_state: ${syncDenied ? "PASS (denied)" : `FAIL: ${sync.error?.message ?? "unexpected success"}`}`,
  );
  if (!syncDenied) throw new Error("Attack test failed: sync_recurring_subscription_state");

  console.log("\nAll attack tests passed.");
}

async function main() {
  loadEnvFile(join(ROOT_DIR, ".env.local"));
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or SUPABASE_DB_PASSWORD required");
  }

  const migrationPath =
    "supabase/migrations/20260610150000_payment_integrity_lockdown.sql";
  const sql = readFileSync(join(ROOT_DIR, migrationPath), "utf8");
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    console.log(`Applying ${migrationPath}...`);
    await client.query(sql);
    console.log("Migration applied successfully.");

    await verifyGrants(client);
  } finally {
    await client.end();
  }

  await runAttackTests();
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
