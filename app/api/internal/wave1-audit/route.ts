import { NextResponse } from "next/server";
import { getOptionalServerEnv } from "@/lib/env/server";
import { auditLog } from "@/lib/security-audit";

export const runtime = "nodejs";

/**
 * Internal Wave 1 verification endpoint. Protected by CRON_SECRET.
 * Not used in production user flows.
 */
export async function POST(request: Request) {
  const cronSecret = getOptionalServerEnv("CRON_SECRET");
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const marker = `auditlog-route-${Date.now()}`;

  await auditLog({
    actorType: "system",
    actorId: marker,
    action: "wave1.verify.audit_log_route",
    resourceType: "security_audit_log",
    resourceId: marker,
    outcome: "success",
    metadata: { source: "auditLog()" },
  });

  return NextResponse.json({ ok: true, marker });
}
