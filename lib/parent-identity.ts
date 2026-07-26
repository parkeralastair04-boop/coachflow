import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type ParentOwnedPlayer = {
  id: string;
  coach_id: string;
  academy_id: string | null;
  player_name: string;
  parent_email: string | null;
};

/**
 * Resolve a child only when parent_email matches the signed-in parent.
 * Academy/coach scope is inherited from the player row — parents cannot
 * escalate to other academies by guessing IDs.
 */
export async function loadPlayerOwnedByParent(args: {
  playerId: string;
  parentEmail: string;
}): Promise<ParentOwnedPlayer | null> {
  const admin = createAdminClient();
  const parentEmail = args.parentEmail.trim().toLowerCase();
  const playerId = args.playerId.trim();
  if (!parentEmail || !playerId) return null;

  const { data, error } = await admin
    .from("players")
    .select("id, coach_id, academy_id, player_name, parent_email")
    .eq("id", playerId)
    .ilike("parent_email", parentEmail)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id as string,
    coach_id: data.coach_id as string,
    academy_id: (data.academy_id as string | null) ?? null,
    player_name: data.player_name as string,
    parent_email: (data.parent_email as string | null) ?? null,
  };
}

export async function assertPlayersOwnedByParent(args: {
  playerIds: string[];
  parentEmail: string;
}): Promise<{ ok: true; players: ParentOwnedPlayer[] } | { ok: false }> {
  const uniqueIds = [...new Set(args.playerIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return { ok: false };

  const admin = createAdminClient();
  const parentEmail = args.parentEmail.trim().toLowerCase();

  const { data, error } = await admin
    .from("players")
    .select("id, coach_id, academy_id, player_name, parent_email")
    .in("id", uniqueIds)
    .ilike("parent_email", parentEmail);

  if (error || !data || data.length !== uniqueIds.length) {
    return { ok: false };
  }

  return {
    ok: true,
    players: data.map((row) => ({
      id: row.id as string,
      coach_id: row.coach_id as string,
      academy_id: (row.academy_id as string | null) ?? null,
      player_name: row.player_name as string,
      parent_email: (row.parent_email as string | null) ?? null,
    })),
  };
}

/** Confirm a camp belongs to the same coach as the owned child. */
export async function assertCampOwnedViaPlayer(args: {
  campId: string;
  coachId: string;
}): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("camps")
    .select("id")
    .eq("id", args.campId)
    .eq("coach_id", args.coachId)
    .maybeSingle();
  return Boolean(data?.id);
}
