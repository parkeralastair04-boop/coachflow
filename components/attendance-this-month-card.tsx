"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, Loader2 } from "lucide-react";
import {
  computeMonthlyAttendanceSummary,
  currentMonthKey,
} from "@/lib/attendance-alerts";
import type { PlayerAttendanceStatus } from "@/lib/attendance";
import { FOOTBALL_LABELS } from "@/lib/football-identity";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function AttendanceThisMonthCard({ className }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    rate: 0,
    present: 0,
    missed: 0,
    total: 0,
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const [{ data: attendance }, { data: sessions }] = await Promise.all([
          supabase
            .from("session_attendance")
            .select("session_id, status")
            .eq("coach_id", user.id),
          supabase
            .from("sessions")
            .select("id, session_date")
            .eq("coach_id", user.id),
        ]);

        if (cancelled) return;

        const sessionsById = new Map(
          (sessions ?? []).map((session) => [session.id, session]),
        );

        setSummary(
          computeMonthlyAttendanceSummary(
            (attendance ?? []) as Array<{
              session_id: string;
              status: PlayerAttendanceStatus;
            }>,
            sessionsById,
            currentMonthKey(),
          ),
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
    return (
      <section
        className={cn(
          "dashboard-insight-panel flex items-center gap-3 p-5 text-sm",
          className,
        )}
        aria-busy="true"
        aria-labelledby="attendance-this-month-heading"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
        <h2 id="attendance-this-month-heading" className="sr-only">
          {FOOTBALL_LABELS.attendance}
        </h2>
        Loading attendance summary...
      </section>
    );
  }

  return (
    <section
      className={cn("dashboard-insight-panel p-5 sm:p-6", className)}
      aria-labelledby="attendance-this-month-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.1]"
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="attendance-this-month-heading" className="text-lg font-semibold tracking-tight">
            {FOOTBALL_LABELS.attendance}
          </h2>
          <p className="text-muted mt-1 text-sm">
            {summary.total > 0
              ? "Marked registers this month across your training sessions."
              : "Take registers after sessions — attendance insights appear here."}
          </p>
        </div>
        <div className="bg-accent/10 ring-accent/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
          <ClipboardCheck className="text-accent size-5" aria-hidden />
        </div>
      </div>

      <div className="relative mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-muted text-[11px] font-bold tracking-[0.16em] uppercase">Rate</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            {summary.total > 0 ? `${summary.rate}%` : "—"}
          </p>
        </div>
        <div>
          <p className="text-muted text-[11px] font-bold tracking-[0.16em] uppercase">Present</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{summary.present}</p>
        </div>
        <div>
          <p className="text-muted text-[11px] font-bold tracking-[0.16em] uppercase">Missed</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{summary.missed}</p>
        </div>
      </div>

      <Link
        href="/dashboard/registers"
        className="text-accent relative mt-5 inline-flex items-center gap-1.5 text-sm font-medium"
      >
        Open session registers
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </section>
  );
}
