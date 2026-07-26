import { NextResponse } from "next/server";
import { formatMatchScoreLabel } from "@/lib/match-insights";
import {
  formatMatchKickoff,
  getMatchTitle,
  MATCH_COMPETITION_LABELS,
  MATCH_STATUS_LABELS,
  type ParentMatchAvailability,
} from "@/lib/match-types";
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
      .select("id, player_name, coach_id")
      .ilike("parent_email", access.parentEmail);

    const playerIds = (players ?? []).map((row) => row.id as string);
    if (playerIds.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    const { data: squadRows } = await admin
      .from("match_squad_players")
      .select(
        "match_id, player_id, parent_availability, role, is_goalkeeper, is_starter, squad_order, match:matches(id, opposition, competition_type, competition_name, venue, is_home, kickoff_date, kickoff_time, meet_time, pitch, status, squad_published, match_data, report_id, team:teams(team_name))",
      )
      .in("player_id", playerIds);

    type SquadRow = {
      match_id: string;
      player_id: string;
      parent_availability: ParentMatchAvailability;
      role: string | null;
      is_goalkeeper: boolean;
      is_starter: boolean;
      squad_order: number;
      match: {
        id: string;
        opposition: string;
        competition_type: string;
        competition_name: string | null;
        venue: string | null;
        is_home: boolean;
        kickoff_date: string;
        kickoff_time: string | null;
        meet_time: string | null;
        pitch: string | null;
        status: string;
        squad_published: boolean;
        match_data: unknown;
        report_id: string | null;
        team: { team_name: string } | { team_name: string }[] | null;
      } | null;
    };

    const rows = (squadRows ?? []) as unknown as SquadRow[];
    const matchMap = new Map<string, SquadRow["match"] & { id: string }>();
    for (const row of rows) {
      const match = Array.isArray(row.match) ? row.match[0] ?? null : row.match;
      if (!match?.id) continue;
      matchMap.set(match.id, match);
    }

    const matches = [...matchMap.values()].map((match) => {
      if (!match) return null;
      const team = Array.isArray(match.team) ? match.team[0] ?? null : match.team;
      const teamName = team?.team_name ?? "Your team";
      const playerSquads = rows.filter((row) => row.match_id === match.id);
      const childEntries = playerSquads
        .filter((row) => playerIds.includes(row.player_id as string))
        .map((row) => {
          const player = (players ?? []).find((item) => item.id === row.player_id);
          return {
            playerId: row.player_id as string,
            playerName: player?.player_name as string,
            parentAvailability: row.parent_availability as ParentMatchAvailability,
            role: row.role,
            isGoalkeeper: row.is_goalkeeper,
            isStarter: row.is_starter,
            squadOrder: row.squad_order,
          };
        });

      return {
        id: match.id,
        title: getMatchTitle(
          { is_home: match.is_home, opposition: match.opposition },
          teamName,
        ),
        opposition: match.opposition,
        competitionType: match.competition_type,
        competitionLabel:
          MATCH_COMPETITION_LABELS[
            match.competition_type as keyof typeof MATCH_COMPETITION_LABELS
          ],
        competitionName: match.competition_name,
        venue: match.venue,
        isHome: match.is_home,
        kickoffDate: match.kickoff_date,
        kickoffTime: match.kickoff_time,
        meetTime: match.meet_time,
        pitch: match.pitch,
        status: match.status,
        statusLabel: MATCH_STATUS_LABELS[match.status as keyof typeof MATCH_STATUS_LABELS],
        kickoffLabel: formatMatchKickoff(match.kickoff_date, match.kickoff_time),
        scoreLabel: formatMatchScoreLabel({ match_data: match.match_data }),
        squadPublished: match.squad_published,
        reportId: match.report_id,
        children: childEntries,
        publishedSquad: match.squad_published
          ? childEntries.sort((left, right) => left.squadOrder - right.squadOrder)
          : [],
      };
    }).filter((match): match is NonNullable<typeof match> => match !== null);

    return NextResponse.json({
      matches: matches.sort((left, right) => right.kickoffDate.localeCompare(left.kickoffDate)),
    });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to load fixtures.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type PatchBody = {
  matchId?: string;
  playerId?: string;
  availability?: ParentMatchAvailability;
};

export async function PATCH(request: Request) {
  try {
    const access = await requireParentPortalAccess();
    if (!access.ok) return access.response;

    const body = (await request.json()) as PatchBody;
    const matchId = body.matchId?.trim();
    const playerId = body.playerId?.trim();
    const availability = body.availability;

    if (!matchId || !playerId || !availability) {
      return NextResponse.json(
        { error: "matchId, playerId, and availability are required." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: player } = await admin
      .from("players")
      .select("id")
      .eq("id", playerId)
      .ilike("parent_email", access.parentEmail)
      .maybeSingle();

    if (!player) {
      return NextResponse.json({ error: "Player not found for this family." }, { status: 404 });
    }

    const { error } = await admin
      .from("match_squad_players")
      .update({ parent_availability: availability, updated_at: new Date().toISOString() })
      .eq("match_id", matchId)
      .eq("player_id", playerId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "Availability updated.",
    });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to update availability.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
