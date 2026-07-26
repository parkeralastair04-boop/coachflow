import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
function loadEnv(p: string) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    process.env[k] = v;
  }
}
loadEnv(join(ROOT, ".env.local"));

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await admin
    .from("player_recurring_enrolments")
    .select("expires_at")
    .limit(1);
  console.log("expires_at column:", error ? `MISSING (${error.message})` : "OK");
  const { error: rpcErr } = await admin.rpc("attach_stripe_checkout_to_session_booking", {
    p_booking_id: "00000000-0000-0000-0000-000000000000",
    p_stripe_checkout_session_id: "cs_probe",
    p_checkout_expires_at: Math.floor(Date.now() / 1000) + 1800,
  });
  console.log("attach RPC:", rpcErr?.message ?? "ok");
}

main();
