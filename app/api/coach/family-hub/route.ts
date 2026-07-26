import { NextResponse } from "next/server";
import {
  approveChildPending,
  approveFamilyPending,
  AVAILABILITY_LABELS,
  parseFamilySelfService,
  SESSION_RESPONSE_LABELS,
} from "@/lib/family-self-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const { data: players, error } = await supabase
      .from("players")
      .select("id, player_name, parent_name, parent_email, parent_self_service")
      .eq("coach_id", user.id)
      .order("player_name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const pendingProfiles: Array<{
      playerId: string;
      playerName: string;
      parentName: string | null;
      type: "family" | "child";
      changes: Record<string, unknown>;
    }> = [];

    const upcomingAbsences: Array<{
      playerId: string;
      playerName: string;
      type: string;
      note: string | null;
      updatedAt: string;
    }> = [];

    const sessionResponses: Array<{
      playerId: string;
      playerName: string;
      sessionId: string;
      status: string;
      reason: string | null;
      updatedAt: string;
    }> = [];

    const paymentPauseRequests: Array<{
      playerId: string;
      playerName: string;
      reason: string | null;
      requestedAt: string;
    }> = [];

    const documentStatus: Array<{
      playerId: string;
      playerName: string;
      completedCount: number;
      totalCount: number;
    }> = [];

    for (const row of players ?? []) {
      const record = parseFamilySelfService(row.parent_self_service);
      const playerId = row.id as string;
      const playerName = row.player_name as string;

      if (record.familyPending) {
        pendingProfiles.push({
          playerId,
          playerName,
          parentName: row.parent_name as string | null,
          type: "family",
          changes: record.familyPending,
        });
      }
      if (record.childPending) {
        pendingProfiles.push({
          playerId,
          playerName,
          parentName: row.parent_name as string | null,
          type: "child",
          changes: record.childPending,
        });
      }

      for (const entry of record.availability) {
        upcomingAbsences.push({
          playerId,
          playerName,
          type: AVAILABILITY_LABELS[entry.type],
          note: entry.note,
          updatedAt: entry.updatedAt,
        });
      }

      for (const [sessionId, response] of Object.entries(record.sessionResponses)) {
        sessionResponses.push({
          playerId,
          playerName,
          sessionId,
          status: SESSION_RESPONSE_LABELS[response.status],
          reason: response.reason,
          updatedAt: response.updatedAt,
        });
      }

      if (record.paymentPauseRequest?.status === "pending") {
        paymentPauseRequests.push({
          playerId,
          playerName,
          reason: record.paymentPauseRequest.reason,
          requestedAt: record.paymentPauseRequest.requestedAt,
        });
      }

      const completedCount = Object.values(record.documents).filter(
        (document) => document?.acknowledged,
      ).length;
      documentStatus.push({
        playerId,
        playerName,
        completedCount,
        totalCount: 4,
      });
    }

    return NextResponse.json({
      pendingProfiles,
      upcomingAbsences: upcomingAbsences.slice(0, 20),
      sessionResponses: sessionResponses.slice(0, 20),
      paymentPauseRequests,
      documentStatus,
      awaitingApprovals:
        pendingProfiles.length + paymentPauseRequests.length,
    });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to load family hub.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type ApprovalBody = {
  playerId?: string;
  approveFamily?: boolean;
  approveChild?: boolean;
  approvePaymentPause?: boolean;
  rejectPaymentPause?: boolean;
};

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const body = (await request.json()) as ApprovalBody;
    const playerId = body.playerId?.trim();
    if (!playerId) {
      return NextResponse.json({ error: "playerId is required." }, { status: 400 });
    }

    const { data: player, error } = await supabase
      .from("players")
      .select("id, parent_phone, parent_self_service")
      .eq("id", playerId)
      .eq("coach_id", user.id)
      .single();

    if (error || !player) {
      return NextResponse.json({ error: "Player not found." }, { status: 404 });
    }

    let record = parseFamilySelfService(player.parent_self_service);

    if (body.approveFamily) {
      record = approveFamilyPending(record);
      if (record.family.phone) {
        await supabase
          .from("players")
          .update({ parent_phone: record.family.phone })
          .eq("coach_id", user.id)
          .eq("id", playerId);
      }
    }

    if (body.approveChild) {
      record = approveChildPending(record);
    }

    if (body.approvePaymentPause && record.paymentPauseRequest) {
      record = {
        ...record,
        paymentPauseRequest: {
          ...record.paymentPauseRequest,
          status: "approved",
          reviewedAt: new Date().toISOString(),
        },
      };
    }

    if (body.rejectPaymentPause && record.paymentPauseRequest) {
      record = {
        ...record,
        paymentPauseRequest: {
          ...record.paymentPauseRequest,
          status: "rejected",
          reviewedAt: new Date().toISOString(),
        },
      };
    }

    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from("players")
      .update({ parent_self_service: record })
      .eq("id", playerId)
      .eq("coach_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to process approval.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
