import { NextResponse } from "next/server";
import { getResendServerClient, resendFromEmail } from "@/lib/resend";
import {
  getPositionSummary,
  normalizeSecondaryPositions,
  type PlayerPositionOption,
  type PreferredFootOption,
} from "@/lib/player-profile";
import { getPlayerTeams, getTeamDisplayName, type TeamSummary } from "@/lib/team-management";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasFeatureAccess } from "@/lib/subscription";
import { getAcademyForUser } from "@/lib/academy";

type SendReportBody = {
  playerId?: string;
  report?: string;
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

function reportToHtml(report: string): string {
  return escapeHtml(report)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replaceAll("\n", "<br />"))
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:#1f2937;line-height:1.65;">${paragraph}</p>`,
    )
    .join("");
}

function reportToText(report: string): string {
  return report.trim();
}

export async function POST(request: Request) {
  try {
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
    const profileSummary = `${getPositionSummary({
      primary_position: safePlayer.primary_position,
      secondary_positions: safePlayer.secondary_positions,
    })} · ${safePlayer.preferred_foot} foot`;
    const teamSummary = getPlayerTeams(safePlayer.team_players)
      .map((team) => getTeamDisplayName(team))
      .join(", ");
    const subject = `Progress Report for ${safePlayer.player_name}`;
    const academy = await getAcademyForUser(user.id);
    const academyName = academy?.name ?? "CoachFlow";
    const primaryColor = academy?.primary_color ?? "#10b981";

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
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">Progress Report for ${escapedPlayerName}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#111827;line-height:1.65;">${greeting}</p>
                <p style="margin:0 0 16px;color:#374151;line-height:1.65;">
                  Here is your latest ${escapeHtml(academyName)} progress report for ${escapedPlayerName}, prepared to keep you updated on recent coaching focus, strengths, and next steps.
                </p>
                <p style="margin:0 0 16px;color:#6b7280;line-height:1.65;">
                  Player profile: ${escapeHtml(profileSummary)}
                </p>
                ${
                  teamSummary
                    ? `<p style="margin:0 0 16px;color:#6b7280;line-height:1.65;">Teams: ${escapeHtml(teamSummary)}</p>`
                    : ""
                }
                <div style="margin:24px 0;padding:20px;border-radius:18px;background:#f9fafb;border:1px solid #e5e7eb;">
                  ${reportToHtml(report)}
                </div>
                <p style="margin:0 0 8px;color:#374151;line-height:1.65;">
                  Thanks for your continued support.
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

Here is your latest ${academyName} progress report for ${safePlayer.player_name}.

Player profile: ${profileSummary}
${teamSummary ? `\nTeams: ${teamSummary}` : ""}

${reportToText(report)}

Thanks for your continued support.

The ${academyName} Team`;

    const resend = getResendServerClient();
    const { data, error } = await resend.emails.send({
      from: resendFromEmail,
      to: safePlayer.parent_email,
      subject,
      html,
      text,
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
