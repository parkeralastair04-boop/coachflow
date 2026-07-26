"use client";

import { useCallback, useEffect, useState } from "react";
import { Cone, Loader2 } from "lucide-react";
import {
  DashboardWidgetPanel,
  DashboardWidgetStat,
} from "@/components/dashboard/dashboard-widget-panel";
import { buildTrainingDashboardSnapshot } from "@/lib/training-insights";
import { createClient } from "@/lib/supabase";
import { isMissingTableError } from "@/lib/supabase-errors";

export function TrainingDashboardWidgets() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<ReturnType<typeof buildTrainingDashboardSnapshot> | null>(
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

      const [plansRes, drillsRes, sessionsRes] = await Promise.all([
        supabase.from("training_plans").select("*").eq("coach_id", user.id),
        supabase.from("training_drills").select("*").eq("coach_id", user.id),
        supabase.from("sessions").select("id, session_date, training_plan_id").eq("coach_id", user.id),
      ]);

      if (plansRes.error) {
        if (isMissingTableError(plansRes.error)) return;
        throw plansRes.error;
      }

      setSnapshot(
        buildTrainingDashboardSnapshot({
          plans: plansRes.data ?? [],
          drills: drillsRes.data ?? [],
          sessions: sessionsRes.data ?? [],
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
        id="training-widgets"
        title="Training Planner"
        description="Today's session, favourites, and recent reflections."
        icon={Cone}
        href="/dashboard/training"
        linkLabel="Open Training Planner"
      >
        <p className="text-muted flex items-center gap-2 text-sm" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading training widgets...
        </p>
      </DashboardWidgetPanel>
    );
  }

  if (!snapshot) return null;
  if (!snapshot.todaysSession && !snapshot.nextPlan && snapshot.favouriteDrills.length === 0) {
    return null;
  }

  return (
    <DashboardWidgetPanel
      id="training-widgets"
      title="Training Planner"
      description="Today's session, favourites, and recent reflections."
      icon={Cone}
      href="/dashboard/training"
      linkLabel="Open Training Planner"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {snapshot.todaysSession ? (
          <DashboardWidgetStat label="Today's session" value={snapshot.todaysSession.title} />
        ) : null}
        {snapshot.nextPlan ? (
          <DashboardWidgetStat label="Next training plan" value={snapshot.nextPlan.title} />
        ) : null}
        <DashboardWidgetStat
          label="Training hours this month"
          value={`${snapshot.trainingHoursThisMonth}h`}
        />
        <DashboardWidgetStat
          label="Favourite drills"
          value={String(snapshot.favouriteDrills.length)}
        />
        <DashboardWidgetStat
          label="Recent reflections"
          value={String(snapshot.recentReflections.length)}
        />
      </div>
    </DashboardWidgetPanel>
  );
}
