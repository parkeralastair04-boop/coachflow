import type { SupabaseClient } from "@supabase/supabase-js";
import { getMatchTitle } from "@/lib/match-types";
import { replaceSessionPlayers } from "@/lib/session-players";

type CreateMatchSessionArgs = {
  coachId: string;
  academyId: string | null;
  teamId: string;
  teamName: string;
  opposition: string;
  isHome: boolean;
  kickoffDate: string;
  kickoffTime: string | null;
  venue: string | null;
  notes: string | null;
  playerId: string;
};

export function buildMatchSessionDate(kickoffDate: string, kickoffTime: string | null): string {
  const time = kickoffTime?.trim() || "10:00:00";
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  return new Date(`${kickoffDate}T${normalizedTime}`).toISOString();
}

export async function ensureMatchSession(
  supabase: SupabaseClient,
  args: CreateMatchSessionArgs & { existingSessionId?: string | null },
): Promise<string> {
  const sessionDate = buildMatchSessionDate(args.kickoffDate, args.kickoffTime);
  const title = getMatchTitle(
    { is_home: args.isHome, opposition: args.opposition },
    args.teamName,
  );

  const payload = {
    coach_id: args.coachId,
    academy_id: args.academyId,
    player_id: args.playerId,
    team_id: args.teamId,
    group_name: title,
    session_date: sessionDate,
    session_type: "Match",
    location: args.venue,
    notes: args.notes,
    attendance_status: "scheduled",
    duration_minutes: 90,
    capacity: 30,
    is_public: false,
    booking_enabled: false,
  };

  if (args.existingSessionId) {
    const { error } = await supabase
      .from("sessions")
      .update(payload)
      .eq("id", args.existingSessionId)
      .eq("coach_id", args.coachId);
    if (error) throw error;
    return args.existingSessionId;
  }

  const { data, error } = await supabase
    .from("sessions")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) throw error ?? new Error("Unable to create match register session.");
  return data.id as string;
}

export async function syncMatchSquadToSessionPlayers(
  supabase: SupabaseClient,
  sessionId: string,
  playerIds: string[],
) {
  await replaceSessionPlayers(supabase, sessionId, playerIds);
}
