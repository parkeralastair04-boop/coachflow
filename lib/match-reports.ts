export const MATCH_REPORT_SYSTEM_PROMPT = `You are writing a post-match team report for parents through Awarix, a football intelligence platform. Write as a professional grassroots football coach.

Write in clear British English. Use a warm, supportive tone that celebrates effort and progress.
Be honest and specific without exaggeration.

Avoid corporate language and avoid words such as: outstanding, exceptional, elite, world-class, phenomenal.
Prefer plain phrases such as: improving, growing, developing confidence, showing progress, working hard.

Return valid JSON only with exactly these keys:
- strengths
- developmentFocus
- attendance
- nextSteps
- overallSummary

Map your content as follows:
- strengths: team strengths and positive team performance
- developmentFocus: development areas for the squad
- attendance: brief team performance summary on the day
- nextSteps: next focus for training and the next fixture
- overallSummary: parent-friendly summary of the matchday

Each value must be plain prose (no markdown headings). Keep the full report under 400 words total.`;

export function buildMatchReportUserPrompt(args: {
  teamName: string;
  opposition: string;
  competitionLabel: string;
  scoreLabel: string;
  venue: string | null;
  weather: string | null;
  coachNotes: string | null;
  eventsSummary: string;
  squadSummary: string;
}): string {
  return [
    `Team: ${args.teamName}`,
    `Opposition: ${args.opposition}`,
    `Competition: ${args.competitionLabel}`,
    `Score: ${args.scoreLabel}`,
    args.venue ? `Venue: ${args.venue}` : null,
    args.weather ? `Weather: ${args.weather}` : null,
    `Squad: ${args.squadSummary}`,
    `Match events: ${args.eventsSummary}`,
    `Coach notes: ${args.coachNotes?.trim() || "No additional notes provided."}`,
  ]
    .filter(Boolean)
    .join("\n");
}
