import OpenAI from "openai";
import { NextResponse } from "next/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  buildMatchReportUserPrompt,
  MATCH_REPORT_SYSTEM_PROMPT,
} from "@/lib/match-reports";
import {
  formatMatchScoreLabel,
  getEventSummary,
  sortSquadPlayers,
} from "@/lib/match-insights";
import {
  MATCH_COMPETITION_LABELS,
  parseMatchData,
} from "@/lib/match-types";
import { serializeStructuredReport, parseStructuredReportFromModelOutput } from "@/lib/structured-report";
import { hasFeatureAccess } from "@/lib/subscription";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type GenerateMatchReportBody = {
  matchId?: string;
  notes?: string;
};

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.aiGenerate,
      route: "/api/matches/generate-report",
    });
    if (limited) return limited;

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const hasReports = await hasFeatureAccess("reports");
    const hasMatchCentre = await hasFeatureAccess("match_centre");
    if (!hasReports || !hasMatchCentre) {
      return NextResponse.json(
        { error: "Match reports require Reports and Match Centre on your plan." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as GenerateMatchReportBody;
    const matchId = body.matchId?.trim();
    if (!matchId) {
      return NextResponse.json({ error: "matchId is required." }, { status: 400 });
    }

    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select(
        "id, opposition, competition_type, competition_name, venue, is_home, match_data, team:teams(team_name)",
      )
      .eq("id", matchId)
      .eq("coach_id", user.id)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    const { data: squadRows } = await supabase
      .from("match_squad_players")
      .select("player_id, squad_order, player:players(player_name)")
      .eq("match_id", matchId)
      .order("squad_order", { ascending: true });

    const squad = sortSquadPlayers((squadRows ?? []) as unknown as Parameters<typeof sortSquadPlayers>[0]);
    const teamName =
      match.team && typeof match.team === "object" && "team_name" in match.team
        ? String(match.team.team_name)
        : "Your team";
    const data = parseMatchData(match.match_data);
    const eventsSummary =
      data.events.length > 0
        ? data.events
            .map((event) => {
              const player = squad.find((row) => row.player_id === event.playerId);
              const playerName = player?.player?.player_name ?? "Player";
              return getEventSummary(event, playerName);
            })
            .join("; ")
        : "No recorded events.";
    const squadSummary = squad
      .map((row) => row.player?.player_name ?? "Player")
      .join(", ");

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: MATCH_REPORT_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildMatchReportUserPrompt({
            teamName,
            opposition: match.opposition as string,
            competitionLabel: MATCH_COMPETITION_LABELS[match.competition_type as keyof typeof MATCH_COMPETITION_LABELS],
            scoreLabel: formatMatchScoreLabel({ match_data: match.match_data }),
            venue: match.venue as string | null,
            weather: data.result?.weather ?? null,
            coachNotes: body.notes?.trim() || data.reportNotes,
            eventsSummary,
            squadSummary: squadSummary || "Squad not selected yet.",
          }),
        },
      ],
    });

    const outputText = response.output_text?.trim();
    if (!outputText) {
      return NextResponse.json({ error: "No report content returned." }, { status: 500 });
    }

    const structured = parseStructuredReportFromModelOutput(outputText);
    if (!structured) {
      return NextResponse.json({ error: "Unable to parse match report." }, { status: 500 });
    }
    const captainPlayerId = squad.find((row) => row.role === "captain")?.player_id ?? squad[0]?.player_id;
    if (!captainPlayerId) {
      return NextResponse.json({ error: "Add a squad before generating a match report." }, { status: 400 });
    }

    const reportText = serializeStructuredReport(structured);
    const { data: savedReport, error: saveError } = await supabase
      .from("progress_reports")
      .insert({
        coach_id: user.id,
        player_id: captainPlayerId,
        raw_notes: body.notes?.trim() ?? "",
        report: reportText,
      })
      .select("id")
      .single();

    if (saveError || !savedReport) {
      return NextResponse.json({ error: saveError?.message ?? "Unable to save report." }, { status: 500 });
    }

    const { error: linkError } = await supabase
      .from("matches")
      .update({
        report_id: savedReport.id,
        match_data: { ...data, reportNotes: body.notes?.trim() ?? data.reportNotes },
      })
      .eq("id", matchId)
      .eq("coach_id", user.id);

    if (linkError) {
      await supabase.from("progress_reports").delete().eq("id", savedReport.id);
      return NextResponse.json(
        { error: linkError.message || "Unable to link match report." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, reportId: savedReport.id, report: structured });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to generate match report.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
