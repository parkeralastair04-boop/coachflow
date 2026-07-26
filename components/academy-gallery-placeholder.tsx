import Link from "next/link";

type AcademyGalleryPlaceholderProps = {
  bookHref: string;
  academyName: string;
};

export function AcademyGalleryPlaceholder({
  bookHref,
  academyName,
}: AcademyGalleryPlaceholderProps) {
  return (
    <section
      className="mx-auto flex max-w-xl flex-col items-center px-4 py-6 text-center"
      aria-labelledby="gallery-coming-soon-heading"
    >
      <div className="w-full rounded-3xl bg-black/[0.02] px-6 py-12 dark:bg-white/[0.03]">
        <h2
          id="gallery-coming-soon-heading"
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Our gallery is coming soon.
        </h2>
        <p className="text-muted mt-4 text-sm leading-relaxed sm:text-base">
          Photos from training, camps and fixtures with {academyName} will appear here in future.
        </p>
        <Link
          href={bookHref}
          className="bg-accent text-accent-foreground hover:opacity-90 focus-visible:ring-accent/40 mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full px-6 text-sm font-semibold transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
        >
          Book Training
        </Link>
      </div>
    </section>
  );
}
