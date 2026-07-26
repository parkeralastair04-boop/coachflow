export const TRAINING_DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

export type TrainingDifficulty = (typeof TRAINING_DIFFICULTIES)[number];

export const TIMELINE_SECTION_TYPES = [
  "warm_up",
  "activation",
  "technical",
  "skill_practice",
  "small_sided_game",
  "conditioned_game",
  "cool_down",
  "custom",
] as const;

export type TimelineSectionType = (typeof TIMELINE_SECTION_TYPES)[number];

export const PITCH_ELEMENT_TYPES = [
  "player",
  "cone",
  "goal",
  "pole",
  "mannequin",
  "zone",
  "arrow",
  "ball",
] as const;

export type PitchElementType = (typeof PITCH_ELEMENT_TYPES)[number];

export const DEVELOPMENT_TAGS = [
  "first_touch",
  "passing",
  "finishing",
  "scanning",
  "decision_making",
  "confidence",
  "communication",
  "leadership",
  "dribbling",
  "defending",
  "positioning",
  "work_rate",
] as const;

export type DevelopmentTag = (typeof DEVELOPMENT_TAGS)[number];

export type TimelineSection = {
  id: string;
  sectionType: TimelineSectionType;
  title: string;
  durationMinutes: number;
  drillId: string | null;
  notes: string | null;
  order: number;
};

export type PitchElement = {
  id: string;
  type: PitchElementType;
  x: number;
  y: number;
  label: string | null;
  rotation?: number;
};

export type PitchLayout = {
  elements: PitchElement[];
  updatedAt: string | null;
};

export type SessionReflection = {
  wentWell: string | null;
  needsImproving: string | null;
  attendanceImpact: string | null;
  coachNotes: string | null;
  followUpActions: string | null;
  aiSummary: string | null;
  completedAt: string | null;
};

export type TrainingPlanData = {
  timeline: TimelineSection[];
  pitchLayout: PitchLayout;
  reflection: SessionReflection | null;
  linkedPlayerIds: string[];
};

export type TrainingDrillData = {
  pitchLayout: PitchLayout | null;
};

export type TrainingDrillRow = {
  id: string;
  coach_id: string;
  academy_id: string | null;
  name: string;
  description: string | null;
  objectives: string | null;
  organisation: string | null;
  coaching_points: string | null;
  progressions: string | null;
  regressions: string | null;
  equipment: string[];
  duration_minutes: number | null;
  player_numbers: string | null;
  difficulty: TrainingDifficulty;
  category: string | null;
  tags: string[];
  development_tags: DevelopmentTag[];
  is_favourite: boolean;
  archived_at: string | null;
  drill_data: TrainingDrillData | unknown;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TrainingPlanRow = {
  id: string;
  coach_id: string;
  academy_id: string | null;
  session_id: string | null;
  team_id: string | null;
  title: string;
  age_group: string | null;
  theme: string | null;
  objectives: string | null;
  duration_minutes: number | null;
  difficulty: TrainingDifficulty;
  equipment: string[];
  coach_notes: string | null;
  expected_outcomes: string | null;
  tags: string[];
  development_focus: DevelopmentTag[];
  match_objective: string | null;
  is_favourite: boolean;
  archived_at: string | null;
  parent_visible: boolean;
  parent_message: string | null;
  parent_equipment_note: string | null;
  parent_preparation_note: string | null;
  plan_data: TrainingPlanData | unknown;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export const TIMELINE_SECTION_LABELS: Record<TimelineSectionType, string> = {
  warm_up: "Warm-up",
  activation: "Activation",
  technical: "Technical",
  skill_practice: "Skill practice",
  small_sided_game: "Small-sided game",
  conditioned_game: "Conditioned game",
  cool_down: "Cool-down",
  custom: "Custom section",
};

export const DIFFICULTY_LABELS: Record<TrainingDifficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const DEVELOPMENT_TAG_LABELS: Record<DevelopmentTag, string> = {
  first_touch: "First touch",
  passing: "Passing",
  finishing: "Finishing",
  scanning: "Scanning",
  decision_making: "Decision making",
  confidence: "Confidence",
  communication: "Communication",
  leadership: "Leadership",
  dribbling: "Dribbling",
  defending: "Defending",
  positioning: "Positioning",
  work_rate: "Work rate",
};

export const PITCH_ELEMENT_LABELS: Record<PitchElementType, string> = {
  player: "Player",
  cone: "Cone",
  goal: "Goal",
  pole: "Pole",
  mannequin: "Mannequin",
  zone: "Zone",
  arrow: "Arrow",
  ball: "Ball",
};

export function isTrainingDifficulty(value: unknown): value is TrainingDifficulty {
  return typeof value === "string" && TRAINING_DIFFICULTIES.includes(value as TrainingDifficulty);
}

export function isDevelopmentTag(value: unknown): value is DevelopmentTag {
  return typeof value === "string" && DEVELOPMENT_TAGS.includes(value as DevelopmentTag);
}

export function parseTrainingPlanData(raw: unknown): TrainingPlanData {
  const base: TrainingPlanData = {
    timeline: [],
    pitchLayout: { elements: [], updatedAt: null },
    reflection: null,
    linkedPlayerIds: [],
  };
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Record<string, unknown>;
  const timeline = Array.isArray(data.timeline) ? (data.timeline as TimelineSection[]) : [];
  const pitch = data.pitchLayout as PitchLayout | undefined;
  const reflection =
    data.reflection && typeof data.reflection === "object"
      ? (data.reflection as SessionReflection)
      : null;
  const linkedPlayerIds = Array.isArray(data.linkedPlayerIds)
    ? (data.linkedPlayerIds as string[])
    : [];
  return {
    timeline: [...timeline].sort((left, right) => left.order - right.order),
    pitchLayout: pitch ?? base.pitchLayout,
    reflection,
    linkedPlayerIds,
  };
}

export function parseTrainingDrillData(raw: unknown): TrainingDrillData {
  if (!raw || typeof raw !== "object") return { pitchLayout: null };
  const data = raw as Record<string, unknown>;
  return {
    pitchLayout:
      data.pitchLayout && typeof data.pitchLayout === "object"
        ? (data.pitchLayout as PitchLayout)
        : null,
  };
}

export function getTimelineDurationTotal(sections: TimelineSection[]): number {
  return sections.reduce((total, section) => total + (section.durationMinutes || 0), 0);
}

export function createDefaultTimeline(): TimelineSection[] {
  return TIMELINE_SECTION_TYPES.filter((type) => type !== "custom").map((sectionType, index) => ({
    id: crypto.randomUUID(),
    sectionType,
    title: TIMELINE_SECTION_LABELS[sectionType],
    durationMinutes: sectionType === "warm_up" || sectionType === "cool_down" ? 10 : 15,
    drillId: null,
    notes: null,
    order: index,
  }));
}
