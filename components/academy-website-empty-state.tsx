import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

type AcademyWebsiteEmptyStateProps = {
  title: string;
  description: string;
  bookHref?: string;
  contactHref?: string;
  bookLabel?: string;
};

/** Professional empty state for public academy website sections. */
export function AcademyWebsiteEmptyState({
  title,
  description,
  bookHref,
  contactHref,
  bookLabel = "Book training",
}: AcademyWebsiteEmptyStateProps) {
  return (
    <div
      className="motion-fade-in rounded-3xl bg-black/[0.02] px-6 py-10 text-center dark:bg-white/[0.03] sm:px-10"
      role="status"
    >
      <p className={TYPE.sectionTitle}>{title}</p>
      <p className={cn(TYPE.description, "mx-auto mt-3 max-w-md")}>{description}</p>
      {(bookHref || contactHref) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {bookHref ? (
            <Link
              href={bookHref}
              className={buttonVariants({ variant: "accent" })}
            >
              {bookLabel}
            </Link>
          ) : null}
          {contactHref ? (
            <Link
              href={contactHref}
              className={buttonVariants({ variant: "outline" })}
            >
              Contact
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
