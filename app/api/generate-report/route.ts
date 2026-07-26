import OpenAI from "openai";
import { NextResponse } from "next/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getMinimumPlanForGateFeature } from "@/lib/feature-definitions";
import {
  getPositionSummary,
  isPlayerPositionOption,
  isPreferredFootOption,
  normalizeSecondaryPositions,
  type PlayerPositionOption,
  type PreferredFootOption,
} from "@/lib/player-profile";
import {
  DEFAULT_REPORT_TEMPLATE,
  getReportTemplatePrompt,
  isReportTemplateId,
  type ReportTemplateId,
} from "@/lib/report-templates";
import { parseStructuredReportFromModelOutput } from "@/lib/structured-report";
import { hasFeatureAccess } from "@/lib/subscription";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `You are writing player development reports for Awarix, a premium football intelligence platform.

Write as a professional grassroots football coach speaking to parents.
Use clear British English. Warm, encouraging, and specific — never exaggerated.

Avoid corporate language and avoid words such as: outstanding, exceptional, elite, world-class, phenomenal.
Prefer plain phrases such as: improving, growing, developing confidence, showing progress, working hard.

Return valid JSON only with exactly these keys:
- strengths
- developmentFocus
- attendance
- nextSteps
- overallSummary

Each value must be plain prose (no markdown headings). Keep the full report under 350 words total.`;

type GenerateReportBody = {
  playerName?: string;
  template?: string;
  playerProfile?: {
    preferredFoot?: PreferredFootOption;
    primaryPosition?: PlayerPositionOption | null;
    secondaryPositions?: PlayerPositionOption[];
    teamNames?: string[];
    attendanceSummary?: {
      attendanceRate?: number;
      counts?: Record<string, number>;
      recent?: Array<{ label?: string; status?: string }>;
    } | null;
    reportCount?: number;
    previousReportExcerpt?: string | null;
    recentForm?: string | null;
  };
  notes?: string;
};

function buildAttendanceContext(
  attendanceSummary: NonNullable<GenerateReportBody["playerProfile"]>["attendanceSummary"],
): string {
  if (!attendanceSummary) return "No recorded attendance history yet.";

  const rate = attendanceSummary.attendanceRate ?? 0;
  const counts = Object.entries(attendanceSummary.counts ?? {})
    .map(([key, value]) => `${key} ${value}`)
    .join(", ");
  const recent = (attendanceSummary.recent ?? [])
    .map((entry) => `${entry.label ?? "Session"}: ${entry.status ?? "Unknown"}`.trim())
    .join(" | ");

  return `${rate}% attendance overall. Status counts: ${counts || "none recorded"}. Recent sessions: ${recent || "none recorded"}.`;
}

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.aiGenerate,
      route: "/api/generate-report",
    });
    if (limited) return limited;

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const allowed = await hasFeatureAccess("reports");
    if (!allowed) {
      return NextResponse.json(
        {
          error: "AI reports require a higher Awarix plan.",
          requiredPlan: getMinimumPlanForGateFeature("reports"),
        },
        { status: 403 },
      );
    }

    const body = (await request.json()) as GenerateReportBody;
    const playerName = body.playerName?.trim();
    const notes = body.notes?.trim();
    const template: ReportTemplateId =
      body.template && isReportTemplateId(body.template)
        ? body.template
        : DEFAULT_REPORT_TEMPLATE;
    const preferredFoot = isPreferredFootOption(body.playerProfile?.preferredFoot)
      ? body.playerProfile.preferredFoot
      : "Unknown";
    const primaryPosition = isPlayerPositionOption(body.playerProfile?.primaryPosition)
      ? body.playerProfile.primaryPosition
      : null;
    const secondaryPositions = normalizeSecondaryPositions(
      body.playerProfile?.secondaryPositions,
    );
    const teamNames = Array.isArray(body.playerProfile?.teamNames)
      ? body.playerProfile.teamNames
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
    const attendanceSummary = body.playerProfile?.attendanceSummary;
    const reportCount = body.playerProfile?.reportCount ?? 0;
    const previousReportExcerpt = body.playerProfile?.previousReportExcerpt?.trim() ?? "";
    const recentForm = body.playerProfile?.recentForm?.trim() ?? "";

    if (!playerName || !notes) {
      return NextResponse.json(
        { error: "playerName and notes are required." },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY environment variable." },
        { status: 500 },
      );
    }

    const continuityLines = [
      reportCount > 0 ? `Saved reports for this player: ${reportCount}.` : "No saved reports yet.",
      previousReportExcerpt
        ? `Latest previous report excerpt: ${previousReportExcerpt}`
        : "No previous report excerpt available.",
      recentForm ? `Recent attendance form (newest first): ${recentForm}` : "Recent form not available.",
    ].join("\n");

    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Template: ${template}
${getReportTemplatePrompt(template)}

Player: ${playerName}
Preferred foot: ${preferredFoot}
Position: ${getPositionSummary({
            primary_position: primaryPosition,
            secondary_positions: secondaryPositions,
          })}
Teams: ${teamNames.length > 0 ? teamNames.join(", ") : "No current team assigned"}

Attendance data:
${buildAttendanceContext(attendanceSummary)}

Continuity context:
${continuityLines}

Coaching notes:
${notes}

Section guidance:
- strengths: positive progress and qualities
- developmentFocus: 1–2 clear areas to improve
- attendance: brief attendance summary; only mention concerns when relevant (absences, lateness, injury)
- nextSteps: simple actions and encouragement
- overallSummary: positive, supportive conclusion

Reflect the player's position naturally without sounding repetitive.`,
        },
      ],
      temperature: 0.55,
      max_output_tokens: 700,
    });

    const output = response.output_text?.trim();
    if (!output) {
      return NextResponse.json(
        { error: "The AI response was empty. Please try again." },
        { status: 502 },
      );
    }

    const sections = parseStructuredReportFromModelOutput(output);
    if (!sections) {
      return NextResponse.json(
        { error: "Could not parse the generated report. Please try again." },
        { status: 502 },
      );
    }

    const hasContent = Object.values(sections).some((value) => value.trim().length > 0);
    if (!hasContent) {
      return NextResponse.json(
        { error: "The AI response was empty. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ sections });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Failed to generate report.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
