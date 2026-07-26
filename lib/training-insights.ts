import {
  DEVELOPMENT_TAG_LABELS,
  getTimelineDurationTotal,
  parseTrainingPlanData,
  type DevelopmentTag,
  type TrainingDrillRow,
  type TrainingPlanRow,
} from "@/lib/training-types";

export type TrainingDashboardSnapshot = {
  todaysSession: {
    planId: string;
    title: string;
    sessionDate: string | null;
  } | null;
  nextPlan: TrainingPlanRow | null;
  favouriteDrills: TrainingDrillRow[];
  recentReflections: Array<{ planId: string; title: string; summary: string; completedAt: string }>;
  trainingHoursThisMonth: number;
};

export type TrainingAnalyticsSummary = {
  trainingHours: number;
  mostUsedDrills: Array<{ drillId: string; name: string; count: number }>;
  developmentThemes: Array<{ tag: DevelopmentTag; count: number }>;
  plansCompleted: number;
  activePlans: number;
};

export function buildTrainingDashboardSnapshot(args: {
  plans: TrainingPlanRow[];
  drills: TrainingDrillRow[];
  sessions: Array<{ id: string; session_date: string; training_plan_id: string | null }>;
}): TrainingDashboardSnapshot {
  const today = new Date().toISOString().slice(0, 10);
  const activePlans = args.plans.filter((plan) => !plan.archived_at);

  const todaysPlan = activePlans.find((plan) => {
    if (!plan.session_id) return false;
    const session = args.sessions.find((item) => item.id === plan.session_id);
    return session?.session_date.slice(0, 10) === today;
  });

  const todaysSession = todaysPlan
    ? {
        planId: todaysPlan.id,
        title: todaysPlan.title,
        sessionDate:
          args.sessions.find((item) => item.id === todaysPlan.session_id)?.session_date ?? null,
      }
    : null;

  const upcomingPlans = activePlans
    .filter((plan) => plan.session_id)
    .map((plan) => {
      const session = args.sessions.find((item) => item.id === plan.session_id);
      return { plan, sessionDate: session?.session_date ?? "" };
    })
    .filter((entry) => entry.sessionDate >= new Date().toISOString())
    .sort((left, right) => left.sessionDate.localeCompare(right.sessionDate));

  const nextPlan = upcomingPlans[0]?.plan ?? activePlans[0] ?? null;

  const favouriteDrills = args.drills
    .filter((drill) => drill.is_favourite && !drill.archived_at)
    .slice(0, 5);

  const recentReflections = activePlans
    .map((plan) => {
      const reflection = parseTrainingPlanData(plan.plan_data).reflection;
      if (!reflection?.completedAt) return null;
      return {
        planId: plan.id,
        title: plan.title,
        summary: reflection.aiSummary ?? reflection.wentWell ?? "Reflection saved",
        completedAt: reflection.completedAt,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .slice(0, 5);

  const monthPrefix = today.slice(0, 7);
  const trainingHoursThisMonth =
    activePlans
      .filter((plan) => plan.updated_at.startsWith(monthPrefix))
      .reduce((total, plan) => {
        const timeline = parseTrainingPlanData(plan.plan_data).timeline;
        const minutes = plan.duration_minutes ?? getTimelineDurationTotal(timeline);
        return total + minutes / 60;
      }, 0) || 0;

  return {
    todaysSession,
    nextPlan,
    favouriteDrills,
    recentReflections,
    trainingHoursThisMonth: Math.round(trainingHoursThisMonth * 10) / 10,
  };
}

export function buildTrainingAnalyticsSummary(args: {
  plans: TrainingPlanRow[];
  drills: TrainingDrillRow[];
}): TrainingAnalyticsSummary {
  const activePlans = args.plans.filter((plan) => !plan.archived_at);
  const drillUsage = new Map<string, number>();
  const themeCounts = new Map<DevelopmentTag, number>();

  for (const plan of activePlans) {
    const data = parseTrainingPlanData(plan.plan_data);
    for (const section of data.timeline) {
      if (!section.drillId) continue;
      drillUsage.set(section.drillId, (drillUsage.get(section.drillId) ?? 0) + 1);
    }
    for (const tag of plan.development_focus) {
      themeCounts.set(tag, (themeCounts.get(tag) ?? 0) + 1);
    }
    for (const tag of data.timeline.flatMap(() => plan.development_focus)) {
      themeCounts.set(tag, (themeCounts.get(tag) ?? 0) + 1);
    }
  }

  for (const drill of args.drills) {
    for (const tag of drill.development_tags) {
      themeCounts.set(tag, (themeCounts.get(tag) ?? 0) + 1);
    }
  }

  const trainingHours = activePlans.reduce((total, plan) => {
    const minutes =
      plan.duration_minutes ?? getTimelineDurationTotal(parseTrainingPlanData(plan.plan_data).timeline);
    return total + minutes / 60;
  }, 0);

  const mostUsedDrills = [...drillUsage.entries()]
    .map(([drillId, count]) => ({
      drillId,
      name: args.drills.find((drill) => drill.id === drillId)?.name ?? "Drill",
      count,
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  const developmentThemes = [...themeCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  const plansCompleted = activePlans.filter((plan) => {
    const reflection = parseTrainingPlanData(plan.plan_data).reflection;
    return Boolean(reflection?.completedAt);
  }).length;

  return {
    trainingHours: Math.round(trainingHours * 10) / 10,
    mostUsedDrills,
    developmentThemes,
    plansCompleted,
    activePlans: activePlans.length,
  };
}

export function filterDrillLibrary(
  drills: TrainingDrillRow[],
  filters: {
    query?: string;
    ageGroup?: string;
    theme?: string;
    difficulty?: string;
    category?: string;
    equipment?: string;
    duration?: number;
    favouriteOnly?: boolean;
    includeArchived?: boolean;
  },
): TrainingDrillRow[] {
  const query = filters.query?.trim().toLowerCase() ?? "";
  return drills
    .filter((drill) => (filters.includeArchived ? true : !drill.archived_at))
    .filter((drill) => (filters.favouriteOnly ? drill.is_favourite : true))
    .filter((drill) => {
      if (!query) return true;
      const haystack = [
        drill.name,
        drill.description,
        drill.category,
        ...drill.tags,
        ...drill.development_tags.map((tag) => DEVELOPMENT_TAG_LABELS[tag]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .filter((drill) => (filters.difficulty ? drill.difficulty === filters.difficulty : true))
    .filter((drill) =>
      filters.category ? (drill.category ?? "").toLowerCase() === filters.category!.toLowerCase() : true,
    )
    .filter((drill) =>
      filters.equipment
        ? drill.equipment.some((item) => item.toLowerCase().includes(filters.equipment!.toLowerCase()))
        : true,
    )
    .filter((drill) =>
      filters.duration ? (drill.duration_minutes ?? 0) <= filters.duration : true,
    )
    .sort((left, right) => {
      const leftUsed = left.last_used_at ?? left.created_at;
      const rightUsed = right.last_used_at ?? right.created_at;
      return rightUsed.localeCompare(leftUsed);
    });
}

export function filterTrainingPlans(
  plans: TrainingPlanRow[],
  filters: {
    query?: string;
    theme?: string;
    difficulty?: string;
    favouriteOnly?: boolean;
    includeArchived?: boolean;
  },
): TrainingPlanRow[] {
  const query = filters.query?.trim().toLowerCase() ?? "";
  return plans
    .filter((plan) => (filters.includeArchived ? true : !plan.archived_at))
    .filter((plan) => (filters.favouriteOnly ? plan.is_favourite : true))
    .filter((plan) => (filters.difficulty ? plan.difficulty === filters.difficulty : true))
    .filter((plan) =>
      filters.theme ? (plan.theme ?? "").toLowerCase().includes(filters.theme!.toLowerCase()) : true,
    )
    .filter((plan) => {
      if (!query) return true;
      const haystack = [plan.title, plan.theme, plan.objectives, ...plan.tags]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}
