import { NextResponse } from "next/server";
import {
  mergeChildProfile,
  mergeFamilyProfile,
  parseFamilySelfService,
  setSessionResponse,
  upsertAvailability,
  type AvailabilityType,
  type ChildProfileData,
  type FamilyProfileData,
  type FamilySelfServiceRecord,
  type NotificationPreferences,
  type SessionResponseStatus,
} from "@/lib/family-self-service";
import { loadParentFamilyDashboard } from "@/lib/parent-portal-data";
import { requireParentPortalAccess } from "@/lib/parent-portal-access";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type SelfServiceChild = {
  playerId: string;
  playerName: string;
  record: FamilySelfServiceRecord;
};

async function loadChildrenForParent(parentEmail: string): Promise<SelfServiceChild[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("players")
    .select("id, player_name, parent_email, parent_phone, parent_self_service")
    .ilike("parent_email", parentEmail)
    .order("player_name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    playerId: row.id as string,
    playerName: row.player_name as string,
    record: parseFamilySelfService(row.parent_self_service, {
      parentPhone: row.parent_phone as string | null,
      parentEmail: row.parent_email as string | null,
    }),
  }));
}

async function savePlayerRecord(
  playerId: string,
  parentEmail: string,
  record: FamilySelfServiceRecord,
  syncParentPhone?: string | null,
) {
  const admin = createAdminClient();
  const payload: Record<string, unknown> = {
    parent_self_service: record,
  };
  if (syncParentPhone !== undefined) {
    payload.parent_phone = syncParentPhone;
  }

  const { error } = await admin
    .from("players")
    .update(payload)
    .eq("id", playerId)
    .ilike("parent_email", parentEmail);

  if (error) throw new Error(error.message);
}

export async function GET() {
  try {
    const access = await requireParentPortalAccess();
    if (!access.ok) return access.response;

    const [children, dashboard] = await Promise.all([
      loadChildrenForParent(access.parentEmail),
      loadParentFamilyDashboard({
        parentEmail: access.parentEmail,
        parentDisplayName: access.parentDisplayName,
      }),
    ]);

    const sharedFamily = children[0]?.record.family ?? null;
    const approvalRequired = children[0]?.record.coachApprovalRequired ?? true;

    return NextResponse.json({
      welcomeName: dashboard.welcomeName,
      approvalRequired,
      family: sharedFamily,
      familyPending: children[0]?.record.familyPending ?? null,
      children: children.map((child) => ({
        playerId: child.playerId,
        playerName: child.playerName,
        child: child.record.child,
        childPending: child.record.childPending,
        availability: child.record.availability,
        sessionResponses: child.record.sessionResponses,
        documents: child.record.documents,
        notifications: child.record.notifications,
        paymentPauseRequest: child.record.paymentPauseRequest,
      })),
      upcomingSessions: dashboard.upcomingSessions,
      camps: dashboard.camps,
      subscriptions: dashboard.subscriptions,
      recentPayments: dashboard.recentPayments,
    });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to load family management.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type PatchBody = {
  section?:
    | "family"
    | "child"
    | "availability"
    | "session_response"
    | "notifications"
    | "document"
    | "payment_pause";
  playerId?: string;
  family?: Partial<FamilyProfileData>;
  child?: Partial<ChildProfileData>;
  availability?: {
    id?: string;
    type: AvailabilityType;
    note?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  };
  sessionId?: string;
  sessionResponse?: { status: SessionResponseStatus; reason?: string | null };
  notifications?: Partial<NotificationPreferences>;
  documentId?: string;
  paymentPauseReason?: string | null;
};

export async function PATCH(request: Request) {
  try {
    const access = await requireParentPortalAccess();
    if (!access.ok) return access.response;

    const body = (await request.json()) as PatchBody;
    const children = await loadChildrenForParent(access.parentEmail);
    if (children.length === 0) {
      return NextResponse.json({ error: "No linked children found." }, { status: 404 });
    }

    const approvalRequired = children[0]?.record.coachApprovalRequired ?? true;

    if (body.section === "family" && body.family) {
      for (const child of children) {
        const next = mergeFamilyProfile(child.record, body.family, approvalRequired);
        await savePlayerRecord(
          child.playerId,
          access.parentEmail,
          next,
          approvalRequired ? undefined : body.family.phone ?? null,
        );
      }
      return NextResponse.json({
        ok: true,
        pending: approvalRequired,
        message: approvalRequired
          ? "Family profile submitted for coach review."
          : "Family profile updated.",
      });
    }

    const playerId = body.playerId?.trim();
    if (!playerId) {
      return NextResponse.json({ error: "playerId is required." }, { status: 400 });
    }

    const target = children.find((child) => child.playerId === playerId);
    if (!target) {
      return NextResponse.json({ error: "Player not found for this family." }, { status: 404 });
    }

    let nextRecord = target.record;

    if (body.section === "child" && body.child) {
      nextRecord = mergeChildProfile(nextRecord, body.child, approvalRequired);
    } else if (body.section === "availability" && body.availability) {
      nextRecord = upsertAvailability(nextRecord, {
        type: body.availability.type,
        note: body.availability.note ?? null,
        startDate: body.availability.startDate ?? null,
        endDate: body.availability.endDate ?? null,
        ...(body.availability.id ? { id: body.availability.id } : {}),
      });
    } else if (body.section === "session_response" && body.sessionId && body.sessionResponse) {
      nextRecord = setSessionResponse(nextRecord, body.sessionId, body.sessionResponse);
    } else if (body.section === "notifications" && body.notifications) {
      nextRecord = {
        ...nextRecord,
        notifications: { ...nextRecord.notifications, ...body.notifications },
      };
    } else if (body.section === "document" && body.documentId) {
      nextRecord = {
        ...nextRecord,
        documents: {
          ...nextRecord.documents,
          [body.documentId]: {
            completedAt: new Date().toISOString(),
            acknowledged: true,
          },
        },
      };
    } else if (body.section === "payment_pause") {
      nextRecord = {
        ...nextRecord,
        paymentPauseRequest: {
          status: "pending",
          reason: body.paymentPauseReason ?? null,
          requestedAt: new Date().toISOString(),
          reviewedAt: null,
        },
      };
    } else {
      return NextResponse.json({ error: "Invalid update payload." }, { status: 400 });
    }

    await savePlayerRecord(target.playerId, access.parentEmail, nextRecord);

    const pending = body.section === "child" && approvalRequired;

    return NextResponse.json({
      ok: true,
      pending,
      message:
        body.section === "child" && approvalRequired
          ? "Child profile submitted for coach review."
          : body.section === "payment_pause"
            ? "Pause request sent to your coach."
            : "Saved successfully.",
    });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to save family information.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
