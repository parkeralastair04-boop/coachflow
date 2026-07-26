type SessionPlayerLink = {
  player_id: string;
};

type SessionBookingLink = {
  session_id: string;
  player_id: string;
  booking_status: "pending" | "confirmed" | "waitlist" | "cancelled";
};

export type SessionRosterSource = {
  id: string;
  coach_id: string;
  player_id: string | null;
  team_id: string | null;
  session_players: SessionPlayerLink[] | null;
};

export function buildSessionRosterPlayerIds(args: {
  session: SessionRosterSource;
  sessionBookings: SessionBookingLink[];
  teamPlayerIdsByTeamId: Map<string, string[]>;
}): string[] {
  const rosterIds = new Set<string>();

  for (const link of args.session.session_players ?? []) {
    rosterIds.add(link.player_id);
  }

  for (const booking of args.sessionBookings) {
    if (booking.session_id !== args.session.id || booking.booking_status !== "confirmed") {
      continue;
    }
    rosterIds.add(booking.player_id);
  }

  if (rosterIds.size === 0 && args.session.team_id) {
    for (const playerId of args.teamPlayerIdsByTeamId.get(args.session.team_id) ?? []) {
      rosterIds.add(playerId);
    }
  }

  if (rosterIds.size === 0 && args.session.player_id) {
    rosterIds.add(args.session.player_id);
  }

  return [...rosterIds];
}
