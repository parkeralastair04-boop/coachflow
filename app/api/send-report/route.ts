import { NextResponse } from "next/server";
import { getResendServerClient, resendFromEmail } from "@/lib/resend";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasFeatureAccess } from "@/lib/subscription";

type SendReportBody = {
  playerId?: string;
  report?: string;
};

type PlayerEmailRow = {
  player_name: string;
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
      .select("player_name, parent_name, parent_email")
      .eq("id", playerId)
      .eq("coach_id", user.id)
      .single();

    if (playerError) {
      return NextResponse.json({ error: playerError.message }, { status: 404 });
    }

    const safePlayer = player as PlayerEmailRow | null;
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
    const subject = `Progress Report for ${safePlayer.player_name}`;

    const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:28px 32px;background:#0f172a;color:#ffffff;">
                <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#86efac;">CoachFlow</div>
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">Progress Report for ${escapedPlayerName}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#111827;line-height:1.65;">${greeting}</p>
                <p style="margin:0 0 16px;color:#374151;line-height:1.65;">
                  Here is your latest CoachFlow progress report for ${escapedPlayerName}, prepared to keep you updated on recent coaching focus, strengths, and next steps.
                </p>
                <div style="margin:24px 0;padding:20px;border-radius:18px;background:#f9fafb;border:1px solid #e5e7eb;">
                  ${reportToHtml(report)}
                </div>
                <p style="margin:0 0 8px;color:#374151;line-height:1.65;">
                  Thanks for your continued support.
                </p>
                <p style="margin:0;color:#111827;line-height:1.65;font-weight:600;">The CoachFlow Team</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const text = `${parentName ? `Hi ${parentName},` : "Hi,"}

Here is your latest CoachFlow progress report for ${safePlayer.player_name}.

${reportToText(report)}

Thanks for your continued support.

The CoachFlow Team`;

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
