import { NextResponse } from "next/server";
import { loadParentFamilyDashboard } from "@/lib/parent-portal-data";
import { requireParentPortalAccess } from "@/lib/parent-portal-access";

export const runtime = "nodejs";

export async function GET() {
  try {
    const access = await requireParentPortalAccess();
    if (!access.ok) return access.response;

    const dashboard = await loadParentFamilyDashboard({
      parentEmail: access.parentEmail,
      parentDisplayName: access.parentDisplayName,
    });

    return NextResponse.json(dashboard);
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to load your family dashboard.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
