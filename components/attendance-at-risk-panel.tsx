"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, FileText } from "lucide-react";
import { AttendanceRecentForm } from "@/components/attendance-display";
import {
  buildAttendanceAtRiskPlayers,
  formatLastAttendanceDate,
  type AttendanceAtRiskPlayer,
  type AttendanceRecordRef,
} from "@/lib/attendance-alerts";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function AttendanceAtRiskPanel({ className }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [atRiskPlayers, setAtRiskPlayers] = useState<AttendanceAtRiskPlayer[]>([]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const [{ data: players }, { data: attendance }] = await Promise.all([
          supabase
            .from("players")
            .select("id, player_name")
            .eq("coach_id", user.id)
            .order("player_name", { ascending: true }),
          supabase
            .from("session_attendance")
            .select("player_id, status, recorded_at")
            .eq("coach_id", user.id),
        ]);

        if (cancelled) return;

        const attendanceByPlayer = new Map<string, AttendanceRecordRef[]>();
        for (const row of attendance ?? []) {
          const current = attendanceByPlayer.get(row.player_id) ?? [];
          current.push({
            status: row.status,
            recorded_at: row.recorded_at,
          });
          attendanceByPlayer.set(row.player_id, current);
        }

        setAtRiskPlayers(
          buildAttendanceAtRiskPlayers(players ?? [], attendanceByPlayer),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return null;
  }

  if (atRiskPlayers.length === 0) {
    return null;
  }

  return (
    <section
      className={cn("glass-panel interactive-surface rounded-2xl p-5 sm:p-6", className)}
      aria-labelledby="attendance-at-risk-heading"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
          <AlertTriangle className="size-5 text-amber-700 dark:text-amber-300" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 id="attendance-at-risk-heading" className="text-lg font-semibold tracking-tight">
            Attendance needs attention
          </h2>
          <p className="text-muted mt-1 text-sm">
            These players may need a quick follow-up.
          </p>
        </div>
      </div>

      <ul className="mt-5 space-y-3" aria-label="Players with attendance concerns">
        {atRiskPlayers.map((player) => (
          <li
            key={player.playerId}
            className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold">{player.playerName}</p>
                <p
                  className="text-muted mt-1 text-sm"
                  role="status"
                  aria-live="polite"
                >
                  {Math.round(player.rate)}% attendance · Last marked{" "}
                  {formatLastAttendanceDate(player.lastAttendanceDate)}
                </p>
                <div className="mt-3">
                  <AttendanceRecentForm
                    entries={player.recentForm.map((status) => ({ status }))}
                    id={`at-risk-form-${player.playerId}`}
                    showLegend={false}
                  />
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link
                  href={`/dashboard/players?player=${player.playerId}`}
                  className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                >
                  View player
                </Link>
                <Link
                  href={`/dashboard/reports?player=${player.playerId}`}
                  className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                >
                  <FileText className="size-4" aria-hidden />
                  Create report
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Link
        href="/dashboard/analytics"
        className="text-accent focus-visible:ring-accent/40 mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        View analytics
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </section>
  );
}
