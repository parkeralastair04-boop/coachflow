import Link from "next/link";
import { cn } from "@/lib/utils";

type AcademyWebsiteCtaProps = {
  title: string;
  description: string;
  bookHref: string;
  parentLoginHref?: string;
  className?: string;
};

export function AcademyWebsiteCta({
  title,
  description,
  bookHref,
  parentLoginHref,
  className,
}: AcademyWebsiteCtaProps) {
  return (
    <section
      className={cn(
        "rounded-3xl px-6 py-10 sm:px-10",
        "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]",
        "ring-1 ring-[color-mix(in_srgb,var(--accent)_28%,transparent)]",
        className,
      )}
      aria-labelledby="academy-booking-cta-heading"
    >
      <h2 id="academy-booking-cta-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      <p className="text-muted mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">{description}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href={bookHref}
          className="bg-accent text-accent-foreground hover:opacity-90 focus-visible:ring-accent/40 inline-flex min-h-12 w-full items-center justify-center rounded-full px-6 text-sm font-semibold transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
        >
          Book Training
        </Link>
        {parentLoginHref ? (
          <Link
            href={parentLoginHref}
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-12 w-full items-center justify-center rounded-full border px-6 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto dark:hover:bg-white/[0.06]"
          >
            Parent Login
          </Link>
        ) : null}
      </div>
    </section>
  );
}
