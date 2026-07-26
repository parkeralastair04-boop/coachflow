import { NextResponse } from "next/server";
import { buildHealthReport } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public liveness/readiness probe.
 * Never returns secrets — only configuration presence and connectivity status.
 */
export async function GET() {
  const report = await buildHealthReport();
  const statusCode =
    report.status === "unhealthy" ? 503 : report.status === "warning" ? 200 : 200;

  return NextResponse.json(report, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
