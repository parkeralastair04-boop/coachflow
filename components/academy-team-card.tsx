import type { PublicTeam } from "@/lib/academy-website-types";

type AcademyTeamCardProps = {
  team: PublicTeam;
};

export function AcademyTeamCard({ team }: AcademyTeamCardProps) {
  const colour = team.colour?.trim() || "var(--accent)";

  return (
    <article
      className="rounded-3xl bg-black/[0.02] p-5 sm:p-6 dark:bg-white/[0.03]"
      aria-labelledby={`team-${team.id}-heading`}
    >
      <div className="flex items-start gap-4">
        <span
          className="mt-1 inline-flex size-11 shrink-0 rounded-xl ring-1 ring-black/5 dark:ring-white/10"
          style={{ backgroundColor: colour }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h2 id={`team-${team.id}-heading`} className="text-lg font-semibold tracking-tight">
            {team.name}
          </h2>
          {team.ageGroup ? (
            <p className="text-muted mt-1 text-sm">Age group: {team.ageGroup}</p>
          ) : (
            <p className="text-muted mt-1 text-sm">Age group not set</p>
          )}
          <p className="text-muted mt-3 text-sm leading-relaxed">{team.summary}</p>
        </div>
      </div>
    </article>
  );
}
