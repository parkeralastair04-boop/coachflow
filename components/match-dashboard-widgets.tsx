"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import {
  DashboardWidgetPanel,
  DashboardWidgetStat,
} from "@/components/dashboard/dashboard-widget-panel";
import { buildMatchDashboardSnapshot } from "@/lib/match-insights";
import { formatMatchKickoff, getMatchTitle } from "@/lib/match-types";
import { createClient } from "@/lib/supabase";
import { isMissingTableError } from "@/lib/supabase-errors";

export function MatchDashboardWidgets() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<ReturnType<typeof buildMatchDashboardSnapshot> | null>(
    null,
  );

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [matchesRes, squadsRes] = await Promise.all([
        supabase
          .from("matches")
          .select("*, team:teams(team_name)")
          .eq("coach_id", user.id)
          .order("kickoff_date", { ascending: false }),
        supabase
          .from("match_squad_players")
          .select("*, player:players(id, player_name)"),
      ]);

      if (matchesRes.error) {
        if (isMissingTableError(matchesRes.error)) return;
        throw matchesRes.error;
      }

      setSnapshot(
        buildMatchDashboardSnapshot({
          matches: matchesRes.data ?? [],
          squads: squadsRes.data ?? [],
        }),
      );
    } catch {
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadSnapshot();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadSnapshot]);

  if (loading) {
    return (
      <DashboardWidgetPanel
        id="match-widgets"
        title="Match Centre"
        description="Upcoming fixtures, availability, and form."
        icon={Trophy}
        href="/dashboard/matches"
        linkLabel="Open Match Centre"
      >
        <p className="text-muted flex items-center gap-2 text-sm" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading match widgets...
        </p>
      </DashboardWidgetPanel>
    );
  }

  if (!snapshot || (!snapshot.upcomingFixture && !snapshot.latestResult)) {
    return null;
  }

  const upcoming = snapshot.upcomingFixture;
  const teamName = upcoming?.team?.team_name ?? "Your team";

  return (
    <DashboardWidgetPanel
      id="match-widgets"
      title="Match Centre"
      description="Upcoming fixtures, availability, and form."
      icon={Trophy}
      href="/dashboard/matches"
      linkLabel="Open Match Centre"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {upcoming ? (
          <DashboardWidgetStat
            label="Upcoming fixture"
            value={
              <>
                <span className="block">{getMatchTitle(upcoming, teamName)}</span>
                <span className="text-muted mt-1 block text-xs font-normal">
                  {formatMatchKickoff(upcoming.kickoff_date, upcoming.kickoff_time)}
                </span>
              </>
            }
          />
        ) : null}
        <DashboardWidgetStat
          label="Awaiting availability"
          value={snapshot.awaitingAvailability}
        />
        {snapshot.latestResult ? (
          <DashboardWidgetStat label="Latest result" value={snapshot.latestResult.scoreLabel} />
        ) : null}
        <DashboardWidgetStat
          label="Unavailable players"
          value={snapshot.unavailablePlayers.length}
        />
        {snapshot.seasonRecord ? (
          <>
            <DashboardWidgetStat
              label="Current form"
              value={snapshot.seasonRecord.currentForm.join(" ") || "—"}
            />
            <DashboardWidgetStat
              label="Season record"
              value={`${snapshot.seasonRecord.won}W ${snapshot.seasonRecord.drawn}D ${snapshot.seasonRecord.lost}L`}
            />
          </>
        ) : null}
      </div>

      {snapshot.unavailablePlayers.length > 0 ? (
        <ul className="mt-4 space-y-2" role="list" aria-label="Unavailable players">
          {snapshot.unavailablePlayers.slice(0, 5).map((player) => (
            <li
              key={`${player.matchId}-${player.playerId}`}
              className="text-muted flex items-center gap-2 text-sm"
              role="listitem"
            >
              <Trophy className="size-4 shrink-0 text-amber-400/80" aria-hidden />
              {player.playerName} unavailable
            </li>
          ))}
        </ul>
      ) : null}
    </DashboardWidgetPanel>
  );
}
