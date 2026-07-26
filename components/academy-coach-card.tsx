import { BrandLogo } from "@/components/brand-logo";
import type { PublicCoach } from "@/lib/academy-website-types";

type AcademyCoachCardProps = {
  coach: PublicCoach;
};

export function AcademyCoachCard({ coach }: AcademyCoachCardProps) {
  const logoSrc = coach.logoUrl?.trim() || undefined;
  const role = coach.role?.trim() || "Coach";
  const biography =
    coach.biography?.trim() || `${coach.displayName} is part of the coaching team.`;

  return (
    <article
      className="rounded-3xl bg-black/[0.02] p-5 sm:p-6 dark:bg-white/[0.03]"
      aria-labelledby={`coach-${coach.id}-heading`}
    >
      <div className="flex items-start gap-4">
        {logoSrc ? (
          <BrandLogo
            src={logoSrc}
            alt={`Profile image for ${coach.displayName}`}
            className="size-14 shrink-0 rounded-2xl object-cover"
          />
        ) : (
          <span
            className="bg-accent/15 text-accent inline-flex size-14 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold"
            aria-hidden
          >
            {coach.displayName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 id={`coach-${coach.id}-heading`} className="text-lg font-semibold tracking-tight">
            {coach.displayName}
          </h2>
          <p className="text-muted mt-1 text-sm">{role}</p>
          <p className="text-muted mt-3 text-sm leading-relaxed">{biography}</p>
        </div>
      </div>
    </article>
  );
}
