export const TRAINING_PLAN_SYSTEM_PROMPT = `You are an Awarix coaching intelligence assistant helping a grassroots football coach plan a training session.

Write in clear British English with a supportive grassroots tone.
Be practical, age-appropriate, and realistic for volunteer coaches.

Return valid JSON only with exactly these keys:
- title
- theme
- objectives
- expectedOutcomes
- coachNotes
- timeline
- drills

timeline must be an array of objects with keys: sectionType, title, durationMinutes, notes.
sectionType must be one of: warm_up, activation, technical, skill_practice, small_sided_game, conditioned_game, cool_down, custom.

drills must be an array of objects with keys: name, description, objectives, organisation, coachingPoints, progressions, regressions, equipment, durationMinutes, playerNumbers, category, developmentTags.
developmentTags must use snake_case values from: first_touch, passing, finishing, scanning, decision_making, confidence, communication, leadership, dribbling, defending, positioning, work_rate.

Keep the full response under 900 words total.`;

export function buildTrainingPlanUserPrompt(args: {
  ageGroup: string;
  ability: string;
  theme: string;
  players: number;
  durationMinutes: number;
  objectives: string;
  equipment: string[];
}): string {
  return [
    `Age group: ${args.ageGroup}`,
    `Ability: ${args.ability}`,
    `Theme: ${args.theme}`,
    `Players: ${args.players}`,
    `Duration: ${args.durationMinutes} minutes`,
    `Objectives: ${args.objectives || "General development"}`,
    `Equipment available: ${args.equipment.length > 0 ? args.equipment.join(", ") : "Cones, bibs, balls"}`,
  ].join("\n");
}

export const TRAINING_REFLECTION_SYSTEM_PROMPT = `You are an Awarix coaching intelligence assistant summarising a post-training reflection for a grassroots football coach.

Write in clear British English with a warm, constructive tone.
Be honest, specific, and supportive.

Return valid JSON only with exactly these keys:
- summary
- followUpFocus

Each value must be plain prose (no markdown headings). Keep the full response under 200 words total.`;

export function buildTrainingReflectionUserPrompt(args: {
  planTitle: string;
  wentWell: string;
  needsImproving: string;
  attendanceImpact: string;
  coachNotes: string;
}): string {
  return [
    `Session plan: ${args.planTitle}`,
    `What went well: ${args.wentWell || "Not provided"}`,
    `What needs improving: ${args.needsImproving || "Not provided"}`,
    `Attendance impact: ${args.attendanceImpact || "Not provided"}`,
    `Coach notes: ${args.coachNotes || "Not provided"}`,
  ].join("\n");
}
