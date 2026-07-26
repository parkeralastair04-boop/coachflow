import type { SupabaseClient } from "@supabase/supabase-js";

function isMissingRpcError(
  error: { message?: string; code?: string } | null,
  functionName: string,
): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST202" ||
    message.includes("could not find the function") ||
    message.includes(functionName.toLowerCase())
  );
}

/**
 * Atomically replaces session roster links. Falls back to delete+insert with
 * restore compensation when the RPC migration is not yet applied.
 */
export async function replaceSessionPlayers(
  supabase: SupabaseClient,
  sessionId: string,
  playerIds: string[],
): Promise<void> {
  const { error } = await supabase.rpc("replace_session_players", {
    p_session_id: sessionId,
    p_player_ids: playerIds,
  });

  if (!error) return;
  if (!isMissingRpcError(error, "replace_session_players")) {
    throw error;
  }

  const { data: previous, error: previousError } = await supabase
    .from("session_players")
    .select("player_id")
    .eq("session_id", sessionId);

  if (previousError) throw previousError;

  const { error: deleteError } = await supabase
    .from("session_players")
    .delete()
    .eq("session_id", sessionId);

  if (deleteError) throw deleteError;

  if (playerIds.length === 0) return;

  const { error: insertError } = await supabase.from("session_players").insert(
    playerIds.map((playerId) => ({
      session_id: sessionId,
      player_id: playerId,
    })),
  );

  if (insertError) {
    const previousIds = (previous ?? []).map((row) => row.player_id as string);
    if (previousIds.length > 0) {
      await supabase.from("session_players").insert(
        previousIds.map((playerId) => ({
          session_id: sessionId,
          player_id: playerId,
        })),
      );
    }
    throw insertError;
  }
}
