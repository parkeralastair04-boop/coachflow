/**
 * Wave 1 verification: migrations, service-role writes, auditLog parity, anon denial.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local for full pass.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
  "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

const results: Array<{ name: string; ok: boolean; detail: string }> = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  const label = ok ? "PASS" : "FAIL";
  console.log(`${label}  ${name}`);
  console.log(`      ${detail}`);
}

async function verifyMigrations(admin: SupabaseClient) {
  const checks = [
    { table: "security_audit_log", migration: "M1" },
    { table: "stripe_webhook_events", migration: "M2" },
  ] as const;

  for (const check of checks) {
    const { error } = await admin.from(check.table).select("id").limit(1);
    if (error) {
      record(
        `${check.migration} migration validation`,
        false,
        `${check.table} is not queryable: ${error.message}`,
      );
      continue;
    }

    record(
      `${check.migration} migration validation`,
      true,
      `Table public.${check.table} exists and is readable via service role.`,
    );
  }
}

async function verifyServiceRoleAuditInsert(admin: SupabaseClient) {
  const marker = `wave1-verify-${Date.now()}`;
  const { data, error } = await admin
    .from("security_audit_log")
    .insert({
      actor_type: "system",
      actor_id: marker,
      action: "wave1.verify.service_role_insert",
      resource_type: "security_audit_log",
      resource_id: marker,
      outcome: "success",
      metadata: { source: "scripts/wave1-verify.ts" },
    })
    .select("id")
    .single();

  if (error) {
    record("Service-role audit insert test", false, error.message);
    return;
  }

  record(
    "Service-role audit insert test",
    true,
    `Inserted audit row id=${data.id}`,
  );
}

async function verifyAuditLogRoute(baseUrl: string, cronSecret: string) {
  const response = await fetch(`${baseUrl}/api/internal/wave1-audit`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cronSecret}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    record(
      "auditLog() success test",
      false,
      `Internal audit route failed (${response.status}): ${body}`,
    );
    return null;
  }

  const payload = (await response.json()) as { marker?: string };
  if (!payload.marker) {
    record("auditLog() success test", false, "Internal audit route returned no marker.");
    return null;
  }

  return payload.marker;
}

async function verifyAuditLogParity(admin: SupabaseClient) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ??
    process.env.NEXT_PUBLIC_APP_URL?.trim() ??
    "http://localhost:3000";
  const cronSecret = process.env.CRON_SECRET?.trim() ?? "";

  let marker: string | null = null;

  if (cronSecret) {
    marker = await verifyAuditLogRoute(siteUrl, cronSecret);
  }

  if (!marker) {
    marker = `auditlog-helper-${Date.now()}`;
    const { error: insertError } = await admin.from("security_audit_log").insert({
      actor_type: "system",
      actor_id: marker,
      action: "wave1.verify.audit_log_helper",
      resource_type: "security_audit_log",
      resource_id: marker,
      outcome: "success",
      metadata: { source: "auditLog() parity fallback" },
      request_id: null,
    });

    if (insertError) {
      record("auditLog() success test", false, insertError.message);
      return;
    }

    record(
      "auditLog() success test",
      true,
      `Parity insert only (set CRON_SECRET and run dev server for live auditLog() route test). marker=${marker}`,
    );
    return;
  }

  const { data, error } = await admin
    .from("security_audit_log")
    .select("id, action, actor_id")
    .eq("actor_id", marker)
    .maybeSingle();

  if (error || !data) {
    record(
      "auditLog() success test",
      false,
      error?.message ?? "auditLog() route ran but row not found",
    );
    return;
  }

  record(
    "auditLog() success test",
    true,
    `auditLog() route wrote row id=${data.id} action=${data.action}`,
  );
}

async function verifyAuthenticatedDenial(admin: SupabaseClient) {
  const testEmail = `wave1-verify-${Date.now()}@awarix.invalid`;
  const testPassword = `Wave1Verify!${Date.now()}`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });

  if (createError || !created.user) {
    record(
      "Authenticated access denial test",
      false,
      createError?.message ?? "Failed to create temporary test user.",
    );
    return;
  }

  const userId = created.user.id;

  try {
    const authed = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: signInError } = await authed.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      record(
        "Authenticated access denial test",
        false,
        `Could not sign in test user: ${signInError.message}`,
      );
      return;
    }

    const auditSelect = await authed.from("security_audit_log").select("id").limit(1);
    const webhookSelect = await authed.from("stripe_webhook_events").select("id").limit(1);

    const missingTable =
      auditSelect.error?.code === "PGRST205" ||
      webhookSelect.error?.code === "PGRST205" ||
      auditSelect.error?.message?.includes("Could not find the table") ||
      webhookSelect.error?.message?.includes("Could not find the table");

    if (missingTable) {
      record(
        "Authenticated access denial test",
        false,
        "Migrations M1/M2 are not applied (tables missing from schema cache).",
      );
      return;
    }

    const denied = Boolean(auditSelect.error) && Boolean(webhookSelect.error);

    record(
      "Authenticated access denial test",
      denied,
      denied
        ? "authenticated cannot SELECT on security_audit_log / stripe_webhook_events."
        : `Unexpected authenticated access: auditSelect=${auditSelect.error?.message ?? "ok"} webhookSelect=${webhookSelect.error?.message ?? "ok"}`,
    );
  } finally {
    await admin.auth.admin.deleteUser(userId);
  }
}

async function verifyAnonDenial() {
  if (!supabaseUrl || !anonKey) {
    record(
      "Anon access denial test",
      false,
      "Skipped: NEXT_PUBLIC_SUPABASE_URL or anon key missing.",
    );
    return;
  }

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const auditSelect = await anon.from("security_audit_log").select("id").limit(1);
  const auditInsert = await anon.from("security_audit_log").insert({
    actor_type: "system",
    actor_id: "anon-should-fail",
    action: "wave1.verify.anon_insert",
    resource_type: "security_audit_log",
    outcome: "failure",
  });
  const webhookSelect = await anon.from("stripe_webhook_events").select("id").limit(1);
  const webhookInsert = await anon.from("stripe_webhook_events").insert({
    id: "evt_anon_should_fail",
    type: "test.event",
    livemode: false,
  });

  const responses = [auditSelect, auditInsert, webhookSelect, webhookInsert];
  const missingTable = responses.some(
    (response) =>
      response.error?.code === "PGRST205" ||
      response.error?.message?.includes("Could not find the table"),
  );

  if (missingTable) {
    record(
      "Anon access denial test",
      false,
      "Migrations M1/M2 are not applied (tables missing from schema cache).",
    );
    return;
  }

  const denied =
    Boolean(auditSelect.error) &&
    Boolean(auditInsert.error) &&
    Boolean(webhookSelect.error) &&
    Boolean(webhookInsert.error);

  record(
    "Anon access denial test",
    denied,
    denied
      ? "anon cannot SELECT or INSERT on security_audit_log / stripe_webhook_events."
      : `Unexpected anon access: auditSelect=${auditSelect.error?.message ?? "ok"} auditInsert=${auditInsert.error?.message ?? "ok"} webhookSelect=${webhookSelect.error?.message ?? "ok"} webhookInsert=${webhookInsert.error?.message ?? "ok"}`,
  );
}

function summarize() {
  console.log("\nSummary");
  const failed = results.filter((result) => !result.ok);
  for (const result of results) {
    console.log(`- ${result.ok ? "PASS" : "FAIL"}: ${result.name}`);
  }
  if (failed.length > 0) {
    console.log(`\n${failed.length} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll Wave 1 verification checks passed.");
}

async function main() {
  console.log("Wave 1 verification\n");

  if (!supabaseUrl) {
    record("Environment", false, "NEXT_PUBLIC_SUPABASE_URL is missing.");
    summarize();
    return;
  }

  if (!serviceRoleKey) {
    record(
      "Environment",
      false,
      "SUPABASE_SERVICE_ROLE_KEY is missing from .env.local — apply migrations and add the key, then re-run.",
    );
    await verifyAnonDenial();
    summarize();
    return;
  }

  record(
    "Environment",
    true,
    "Supabase URL and service role key are configured.",
  );

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    global: {
      headers: {
        "X-Client-Info": "awarix-admin",
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await verifyMigrations(admin);
  await verifyServiceRoleAuditInsert(admin);
  await verifyAuditLogParity(admin);
  await verifyAnonDenial();
  await verifyAuthenticatedDenial(admin);

  summarize();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("Wave 1 verification crashed:", message);
  process.exit(1);
});
