import { NextResponse } from "next/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { prepareParentPortalInvite } from "@/lib/parent-account-claim";
import { buildParentPortalCtaHtml, buildParentPortalCtaText } from "@/lib/parent-notifications";
import { getResendServerClient, resendFromEmail } from "@/lib/resend";
import { generateReportPdf, getReportPdfFilename } from "@/lib/report-pdf";
import {
  normalizeSecondaryPositions,
  type PlayerPositionOption,
  type PreferredFootOption,
} from "@/lib/player-profile";
import {
  formatReportPlainText,
  parseReportContent,
  REPORT_SECTIONS,
} from "@/lib/structured-report";
import { getPlayerTeams, getTeamDisplayName, type TeamSummary } from "@/lib/team-management";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasFeatureAccess } from "@/lib/subscription";
import { getAcademyForUser } from "@/lib/academy";
import { absoluteSitePath } from "@/lib/site-url";
import { rejectDemoMutation } from "@/lib/demo/http-guard";

type SendReportBody = {
  playerId?: string;
  report?: string;
  reportId?: string;
};

type PlayerEmailRow = {
  player_name: string;
  preferred_foot: PreferredFootOption;
  primary_position: PlayerPositionOption | null;
  secondary_positions: PlayerPositionOption[];
  team_players?: { team?: TeamSummary[] | TeamSummary | null }[] | null;
  parent_name: string | null;
  parent_email: string | null;
};

export const runtime = "nodejs";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function structuredReportToHtml(report: string): string {
  const sections = parseReportContent(report);

  return REPORT_SECTIONS.map(({ key, heading }) => {
    const value = sections[key].trim();
    if (!value) return "";

    return `<h3 style="margin:24px 0 8px;font-size:16px;color:#111827;">${escapeHtml(heading)}</h3>
<p style="margin:0 0 16px;color:#1f2937;line-height:1.65;white-space:pre-wrap;">${escapeHtml(value).replaceAll("\n", "<br />")}</p>`;
  })
    .filter(Boolean)
    .join("");
}

function structuredReportToText(report: string): string {
  return formatReportPlainText(parseReportContent(report));
}

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.communicationSend,
      route: "/api/send-report",
    });
    if (limited) return limited;

    const demoBlocked = rejectDemoMutation(request, "send a progress report email");
    if (demoBlocked) return demoBlocked;

    const allowed = await hasFeatureAccess("parent_emails");
    if (!allowed) {
      return NextResponse.json(
        { error: "Parent email communication is available on Pro and Academy." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as SendReportBody;
    const playerId = body.playerId?.trim();
    const report = body.report?.trim();
    const reportId = body.reportId?.trim();

    if (!playerId || !report) {
      return NextResponse.json(
        { error: "playerId and report are required." },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to send reports." },
        { status: 401 },
      );
    }

    const { data: player, error: playerError } = await supabase
      .from("players")
      .select(
        "player_name, preferred_foot, primary_position, secondary_positions, team_players(team:teams(id, team_name, age_group, team_color)), parent_name, parent_email",
      )
      .eq("id", playerId)
      .eq("coach_id", user.id)
      .single();

    if (playerError) {
      return NextResponse.json({ error: playerError.message }, { status: 404 });
    }

    const safePlayer = player
      ? ({
          ...(player as PlayerEmailRow),
          preferred_foot: (player as PlayerEmailRow).preferred_foot ?? "Unknown",
          primary_position: (player as PlayerEmailRow).primary_position ?? null,
          secondary_positions: normalizeSecondaryPositions(
            (player as PlayerEmailRow).secondary_positions,
          ),
          team_players: (player as PlayerEmailRow).team_players ?? [],
        } as PlayerEmailRow)
      : null;
    if (!safePlayer) {
      return NextResponse.json(
        { error: "Selected player was not found." },
        { status: 404 },
      );
    }
    if (!safePlayer.parent_email?.trim()) {
      return NextResponse.json(
        { error: "This player does not have a parent email address." },
        { status: 400 },
      );
    }

    const parentName = safePlayer.parent_name?.trim();
    const greeting = parentName ? `Hi ${escapeHtml(parentName)},` : "Hi,";
    const escapedPlayerName = escapeHtml(safePlayer.player_name);
    const teamNames = getPlayerTeams(safePlayer.team_players).map((team) =>
      getTeamDisplayName(team),
    );
    const subject = `A new progress report is ready`;
    const academy = await getAcademyForUser(user.id);
    const academyName = academy?.name ?? "Awarix";
    const primaryColor = academy?.primary_color ?? "#10b981";
    const reportDate = new Date();
    const pdfBytes = await generateReportPdf({
      playerName: safePlayer.player_name,
      preferredFoot: safePlayer.preferred_foot,
      primaryPosition: safePlayer.primary_position,
      secondaryPositions: safePlayer.secondary_positions,
      teamNames,
      report,
      academyName,
      date: reportDate,
    });
    const pdfFilename = getReportPdfFilename(safePlayer.player_name, reportDate);

    // Mark matching saved report(s) as intentionally shared with parents.
    if (reportId) {
      await supabase
        .from("progress_reports")
        .update({ parent_visible: true })
        .eq("id", reportId)
        .eq("coach_id", user.id)
        .eq("player_id", playerId);
    } else {
      await supabase
        .from("progress_reports")
        .update({ parent_visible: true })
        .eq("coach_id", user.id)
        .eq("player_id", playerId)
        .eq("report", report);
    }

    let portalInviteUrl = absoluteSitePath("/login?next=/family");
    let portalInviteKind: "claim" | "sign_in" = "sign_in";
    try {
      const invite = await prepareParentPortalInvite({
        email: safePlayer.parent_email,
        playerId,
        childName: safePlayer.player_name,
        academyName,
      });
      portalInviteUrl = invite.url;
      portalInviteKind = invite.kind;
    } catch {
      // Fall back to sign-in URL.
    }

    const portalCtaHtml = buildParentPortalCtaHtml({
      inviteUrl: portalInviteUrl,
      inviteKind: portalInviteKind,
      primaryColor,
    });
    const portalCtaText = buildParentPortalCtaText({
      inviteUrl: portalInviteUrl,
      inviteKind: portalInviteKind,
    }).join("\n");

    const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:28px 32px;background:#0f172a;color:#ffffff;">
                <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:${primaryColor};">${escapeHtml(academyName)}</div>
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">Player progress report for ${escapedPlayerName}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#111827;line-height:1.65;">${greeting}</p>
                <p style="margin:0 0 16px;color:#374151;line-height:1.65;">
                  Your coach has shared a new progress report.
                </p>
                <div id="report" style="margin:24px 0;padding:20px;border-radius:18px;background:#f9fafb;border:1px solid #e5e7eb;">
                  ${structuredReportToHtml(report)}
                </div>
                <p style="margin:0 0 8px;color:#374151;line-height:1.65;">
                  View report above, or download the attached PDF.
                </p>
                ${portalCtaHtml}
                <p style="margin:0 0 16px;color:#374151;line-height:1.65;">
                  Questions? Contact your coach.
                </p>
                <p style="margin:0;color:#111827;line-height:1.65;font-weight:600;">The ${escapeHtml(academyName)} Team</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const text = `${parentName ? `Hi ${parentName},` : "Hi,"}

Your coach has shared a new progress report for ${safePlayer.player_name}.

${structuredReportToText(report)}

Download the attached PDF copy of this report.

${portalCtaText}

Questions? Contact your coach.

The ${academyName} Team`;

    const resend = getResendServerClient();
    const { data, error } = await resend.emails.send({
      from: resendFromEmail,
      to: safePlayer.parent_email,
      subject,
      html,
      text,
      attachments: [
        {
          filename: pdfFilename,
          content: Buffer.from(pdfBytes),
        },
      ],
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    return NextResponse.json({ id: data?.id ?? null });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to send report.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
