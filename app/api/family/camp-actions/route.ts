import { NextResponse } from "next/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getCampLinkedSessions, type CampRow, type CampSessionRow } from "@/lib/camp-insights";
import {
  assertCampOwnedViaPlayer,
  loadPlayerOwnedByParent,
} from "@/lib/parent-identity";
import { requireParentPortalAccess } from "@/lib/parent-portal-access";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type CampActionBody = {
  campId?: string;
  playerId?: string;
  action?: "join_waitlist" | "leave_waitlist" | "cancel_booking";
};

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.familyWrite,
      route: "/api/family/camp-actions",
    });
    if (limited) return limited;

    const access = await requireParentPortalAccess();
    if (!access.ok) return access.response;

    const body = (await request.json()) as CampActionBody;
    const campId = body.campId?.trim();
    const playerId = body.playerId?.trim();
    const action = body.action;

    if (!campId || !playerId || !action) {
      return NextResponse.json(
        { error: "campId, playerId, and action are required." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const ownedPlayer = await loadPlayerOwnedByParent({
      playerId,
      parentEmail: access.parentEmail,
    });
    if (!ownedPlayer) {
      return NextResponse.json({ error: "Camp or player not found." }, { status: 404 });
    }

    const campOwned = await assertCampOwnedViaPlayer({
      campId,
      coachId: ownedPlayer.coach_id,
    });
    if (!campOwned) {
      return NextResponse.json({ error: "Camp or player not found." }, { status: 404 });
    }

    const { data: camp } = await admin
      .from("camps")
      .select(
        "id, coach_id, name, start_date, end_date, start_time, end_time, age_group, capacity, price, location, notes, created_at",
      )
      .eq("id", campId)
      .eq("coach_id", ownedPlayer.coach_id)
      .maybeSingle();

    if (!camp) {
      return NextResponse.json({ error: "Camp or player not found." }, { status: 404 });
    }

    const coachId = ownedPlayer.coach_id;
    const { data: sessions } = await admin
      .from("sessions")
      .select("id, session_date, group_name, session_type, session_players(player_id)")
      .eq("coach_id", coachId);

    const linkedSessions = getCampLinkedSessions(camp as CampRow, (sessions ?? []) as CampSessionRow[]);
    const linkedIds = linkedSessions.map((session) => session.id);

    if (linkedIds.length === 0) {
      return NextResponse.json(
        { error: "This camp is not linked to bookable sessions yet. Contact your coach." },
        { status: 400 },
      );
    }

    const { data: bookings } = await admin
      .from("session_bookings")
      .select("id, session_id, booking_status")
      .eq("player_id", playerId)
      .in("session_id", linkedIds);

    const activeBookings = (bookings ?? []).filter(
      (booking) => booking.booking_status !== "cancelled",
    );

    if (action === "cancel_booking" || action === "leave_waitlist") {
      if (activeBookings.length === 0) {
        return NextResponse.json({ error: "No active camp booking found." }, { status: 404 });
      }
      const { error } = await admin
        .from("session_bookings")
        .update({ booking_status: "cancelled" })
        .in(
          "id",
          activeBookings.map((booking) => booking.id as string),
        );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({
        ok: true,
        message:
          action === "leave_waitlist"
            ? "Removed from the camp waiting list."
            : "Camp booking cancelled.",
      });
    }

    if (action === "join_waitlist") {
      if (activeBookings.length > 0) {
        return NextResponse.json({ error: "A camp booking already exists." }, { status: 400 });
      }
      const sessionId = linkedIds[0];
      const { error } = await admin.from("session_bookings").insert({
        coach_id: coachId,
        session_id: sessionId,
        player_id: playerId,
        parent_email: access.parentEmail,
        booking_status: "waitlist",
        payment_status: "not_required",
        amount: 0,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, message: "Added to the camp waiting list." });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to update camp booking.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
