import { NextResponse } from "next/server";
import { getAcademyForUser } from "@/lib/academy";
import { apiError, safeApiError, validationError } from "@/lib/api-response";
import { logAbuseEvent } from "@/lib/abuse-log";
import type { AnnouncementMessageType } from "@/lib/communication-templates";
import {
  buildCoachCommunicationEmailHtml,
  buildCoachCommunicationEmailText,
} from "@/lib/communication-email";
import { requireCommunicationAccess } from "@/lib/communication-access";
import {
  formatCommunicationPreview,
  getCampAttendeePlayerIds,
  mapCommunicationPlayers,
  resolveAnnouncementRecipients,
} from "@/lib/communication-insights";
import { type CampRow, type CampSessionRow } from "@/lib/camp-insights";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getResendServerClient, resendFromEmail } from "@/lib/resend";
import { isValidEmail } from "@/lib/validation/email";
import { rejectDemoMutation } from "@/lib/demo/http-guard";
import {
  clampString,
  parseOptionalEnum,
  parseUuid,
  parseUuidArray,
  ValidationError,
} from "@/lib/validation/common";

export const runtime = "nodejs";

const MAX_RECIPIENTS = 25;

type SendCommunicationBody = {
  kind?: "announcement" | "attendance_follow_up" | "session_reminder";
  subject?: string;
  body?: string;
  messageType?: AnnouncementMessageType | string;
  audience?: "all_families" | "team" | "camp" | "selected";
  teamId?: string;
  campId?: string;
  selectedPlayerIds?: string[];
  playerId?: string;
  parentEmail?: string;
  parentName?: string | null;
  playerName?: string;
};

export async function POST(request: Request) {
  const route = "/api/communication/send";
  try {
    const demoBlocked = rejectDemoMutation(request, "send coach communication email");
    if (demoBlocked) return demoBlocked;

    const access = await requireCommunicationAccess();
    if (!access.ok) return access.response;

    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.communicationSend,
      subject: access.coachId,
      actorId: access.coachId,
      route,
    });
    if (limited) return limited;

    const payload = (await request.json()) as SendCommunicationBody;

    let subject: string;
    let body: string;
    try {
      subject = clampString(payload.subject, { max: 200, field: "subject" });
      body = clampString(payload.body, { max: 10_000, min: 1, field: "body" });
    } catch (error) {
      if (error instanceof ValidationError) {
        return validationError(error.message, request, route);
      }
      throw error;
    }

    const kind =
      parseOptionalEnum(
        payload.kind,
        ["announcement", "attendance_follow_up", "session_reminder"] as const,
        "kind",
      ) ?? "announcement";

    const academy = await getAcademyForUser(access.coachId);
    const branding = {
      academyName: academy?.name ?? "Your academy",
      primaryColor: academy?.primary_color ?? "#10B981",
      supportEmail: academy?.support_email ?? null,
    };

    let recipients: Array<{
      playerId: string | null;
      playerName: string | null;
      parentEmail: string;
      parentName: string | null;
    }> = [];

    if (payload.playerId || payload.parentEmail) {
      const playerId = parseUuid(payload.playerId);
      const parentEmail = payload.parentEmail?.trim() ?? "";
      if (!playerId || !parentEmail || !isValidEmail(parentEmail)) {
        return validationError(
          "playerId and a valid parentEmail are required for direct send.",
          request,
          route,
        );
      }

      const { data: ownedPlayer, error: playerError } = await access.supabase
        .from("players")
        .select("id, player_name, parent_name, parent_email")
        .eq("id", playerId)
        .eq("coach_id", access.coachId)
        .maybeSingle();

      if (playerError || !ownedPlayer) {
        logAbuseEvent({
          event: "communication_blocked",
          route,
          actorId: access.coachId,
          detail: "player_ownership_failed",
          metadata: { playerId },
        });
        return apiError(
          403,
          "You can only message families for your own players.",
          "ownership_denied",
        );
      }

      const ownedEmail = (ownedPlayer.parent_email as string | null)
        ?.trim()
        .toLowerCase();
      if (!ownedEmail || ownedEmail !== parentEmail.toLowerCase()) {
        logAbuseEvent({
          event: "communication_blocked",
          route,
          actorId: access.coachId,
          detail: "parent_email_mismatch",
          metadata: { playerId },
        });
        return apiError(
          403,
          "Parent email does not match the player record.",
          "ownership_denied",
        );
      }

      recipients = [
        {
          playerId: ownedPlayer.id as string,
          playerName: (ownedPlayer.player_name as string | null) ?? null,
          parentEmail: ownedEmail,
          parentName: (ownedPlayer.parent_name as string | null) ?? null,
        },
      ];
    } else {
      let selectedPlayerIds: string[] = [];
      let teamId: string | null = null;
      let campId: string | null = null;
      try {
        selectedPlayerIds = parseUuidArray(payload.selectedPlayerIds, {
          max: MAX_RECIPIENTS,
          field: "selectedPlayerIds",
        });
        teamId = parseUuid(payload.teamId);
        campId = parseUuid(payload.campId);
      } catch (error) {
        if (error instanceof ValidationError) {
          return validationError(error.message, request, route);
        }
        throw error;
      }

      const audience =
        parseOptionalEnum(
          payload.audience,
          ["all_families", "team", "camp", "selected"] as const,
          "audience",
        ) ?? "all_families";

      const [
        { data: playerRows },
        { data: campRows },
        { data: sessionRows },
        { data: bookingRows },
      ] = await Promise.all([
        access.supabase
          .from("players")
          .select(
            "id, player_name, parent_name, parent_email, team_players(team:teams(id, team_name, age_group, team_color))",
          )
          .eq("coach_id", access.coachId),
        campId
          ? access.supabase
              .from("camps")
              .select(
                "id, coach_id, name, start_date, end_date, start_time, end_time, age_group, capacity, price, location, notes, created_at",
              )
              .eq("id", campId)
              .eq("coach_id", access.coachId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        audience === "camp"
          ? access.supabase
              .from("sessions")
              .select(
                "id, session_date, group_name, session_type, session_players(player_id)",
              )
              .eq("coach_id", access.coachId)
          : Promise.resolve({ data: [] }),
        audience === "camp"
          ? access.supabase
              .from("session_bookings")
              .select("session_id, player_id, booking_status")
              .eq("coach_id", access.coachId)
          : Promise.resolve({ data: [] }),
      ]);

      if (audience === "camp" && campId && !campRows) {
        logAbuseEvent({
          event: "ownership_denied",
          route,
          actorId: access.coachId,
          detail: "camp_not_owned",
        });
        return apiError(
          403,
          "Camp not found for this account.",
          "ownership_denied",
        );
      }

      const players = mapCommunicationPlayers(playerRows ?? []);
      let campPlayerIds: string[] | undefined;

      if (audience === "camp" && campRows) {
        const camp = campRows as CampRow;
        campPlayerIds = getCampAttendeePlayerIds({
          camp,
          sessions: (sessionRows ?? []) as CampSessionRow[],
          bookings: (bookingRows ?? []) as Array<{
            session_id: string;
            player_id: string;
            booking_status: string;
          }>,
        });
      }

      const resolved = resolveAnnouncementRecipients({
        audience,
        players,
        teamId: teamId ?? undefined,
        campPlayerIds,
        selectedPlayerIds,
      });

      recipients = resolved.map((player) => ({
        playerId: player.id,
        playerName: player.player_name,
        parentEmail: player.parent_email!.trim(),
        parentName: player.parent_name,
      }));
    }

    if (recipients.length === 0) {
      return apiError(
        400,
        "No families with parent email addresses matched this audience.",
        "validation_failed",
      );
    }

    const batch = recipients.slice(0, MAX_RECIPIENTS);
    const resend = getResendServerClient();
    const sent: Array<{
      playerId: string | null;
      playerName: string | null;
      parentEmail: string;
      parentName: string | null;
      preview: string;
    }> = [];

    for (const recipient of batch) {
      const html = buildCoachCommunicationEmailHtml({
        branding,
        subject,
        body,
      });
      const text = buildCoachCommunicationEmailText({
        branding,
        subject,
        body,
      });

      const { error } = await resend.emails.send({
        from: resendFromEmail,
        to: recipient.parentEmail,
        subject,
        html,
        text,
      });

      if (error) {
        console.error("[communication/send] resend failed", error);
        return apiError(502, "Unable to send message right now.", "unavailable");
      }

      sent.push({
        ...recipient,
        preview: formatCommunicationPreview(body),
      });
    }

    return NextResponse.json({
      sent: sent.length,
      truncated: recipients.length > batch.length,
      recipients: sent,
      kind,
      messageType: payload.messageType ?? null,
      subject,
    });
  } catch (error: unknown) {
    return safeApiError({
      request,
      route,
      error,
      clientMessage: "Unable to send message.",
    });
  }
}
