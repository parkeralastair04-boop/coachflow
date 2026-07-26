import { NextResponse } from "next/server";
import { requireParentPortalAccess } from "@/lib/parent-portal-access";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const access = await requireParentPortalAccess();
    if (!access.ok) return access.response;

    const admin = createAdminClient();
    const { data: players } = await admin
      .from("players")
      .select("id")
      .ilike("parent_email", access.parentEmail);

    const playerIds = (players ?? []).map((row) => row.id as string);
    if (playerIds.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    const { data: bookings } = await admin
      .from("session_bookings")
      .select("session_id")
      .in("player_id", playerIds)
      .eq("booking_status", "confirmed");

    const { data: attendance } = await admin
      .from("session_attendance")
      .select("session_id")
      .in("player_id", playerIds);

    const sessionIds = [
      ...new Set([
        ...(bookings ?? []).map((row) => row.session_id as string),
        ...(attendance ?? []).map((row) => row.session_id as string),
      ]),
    ];

    if (sessionIds.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    const { data: sessions } = await admin
      .from("sessions")
      .select("id, session_date, location, training_plan_id")
      .in("id", sessionIds)
      .not("training_plan_id", "is", null)
      .gte("session_date", new Date().toISOString())
      .order("session_date", { ascending: true });

    const planIds = (sessions ?? [])
      .map((session) => session.training_plan_id as string)
      .filter(Boolean);

    if (planIds.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    const { data: plans } = await admin
      .from("training_plans")
      .select(
        "id, title, theme, parent_visible, parent_message, parent_equipment_note, parent_preparation_note",
      )
      .in("id", planIds)
      .eq("parent_visible", true);

    const visiblePlans = new Map((plans ?? []).map((plan) => [plan.id as string, plan]));

    const payload = (sessions ?? [])
      .map((session) => {
        const plan = visiblePlans.get(session.training_plan_id as string);
        if (!plan) return null;
        return {
          sessionId: session.id as string,
          sessionDate: session.session_date as string,
          location: session.location as string | null,
          theme: plan.theme as string | null,
          title: plan.title as string,
          coachMessage: plan.parent_message as string | null,
          equipmentNote: plan.parent_equipment_note as string | null,
          preparationNote: plan.parent_preparation_note as string | null,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    return NextResponse.json({ sessions: payload });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to load training preparation details.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
