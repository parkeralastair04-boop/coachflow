import { NextResponse } from "next/server";
import {
  buildDiagnosticsPayload,
  requireDiagnosticsAccess,
} from "@/lib/ops-diagnostics";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Founder session or ADMIN_API_SECRET bearer.
 * Returns ops diagnostics without secret values.
 */
export async function GET(request: Request) {
  const limited = await enforceRateLimit({
    request,
    config: RATE_LIMITS.generalApi,
    route: "/api/internal/diagnostics",
  });
  if (limited) return limited;

  const access = await requireDiagnosticsAccess(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const payload = await buildDiagnosticsPayload();
  return NextResponse.json(
    { ...payload, access: access.via },
    { headers: { "Cache-Control": "no-store" } },
  );
}
