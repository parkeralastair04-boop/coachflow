import type { SupabaseClient } from "@supabase/supabase-js";
import { replaceSessionPlayers } from "@/lib/session-players";
import { getTimelineDurationTotal, parseTrainingPlanData, type TrainingPlanRow } from "@/lib/training-types";

type LinkTrainingSessionArgs = {
  coachId: string;
  academyId: string | null;
  plan: TrainingPlanRow;
  teamId: string | null;
  playerId: string;
  sessionDate: string;
  location?: string | null;
  existingSessionId?: string | null;
};

export async function linkTrainingPlanToSession(
  supabase: SupabaseClient,
  args: LinkTrainingSessionArgs,
): Promise<string> {
  const planData = parseTrainingPlanData(args.plan.plan_data);
  const durationMinutes =
    args.plan.duration_minutes ??
    (getTimelineDurationTotal(planData.timeline) || 60);

  const payload = {
    coach_id: args.coachId,
    academy_id: args.academyId,
    player_id: args.playerId,
    team_id: args.teamId,
    group_name: args.plan.title,
    session_date: args.sessionDate,
    session_type: "Group Session",
    location: args.location ?? null,
    notes: args.plan.coach_notes,
    attendance_status: "scheduled",
    duration_minutes: durationMinutes,
    capacity: 30,
    is_public: false,
    booking_enabled: false,
    training_plan_id: args.plan.id,
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

  const { data, error } = await supabase.from("sessions").insert(payload).select("id").single();
  if (error || !data) throw error ?? new Error("Unable to link training session.");
  return data.id as string;
}

export async function syncTrainingPlayersToSession(
  supabase: SupabaseClient,
  sessionId: string,
  playerIds: string[],
) {
  await replaceSessionPlayers(supabase, sessionId, playerIds);
}
