import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Book Football Coaching",
  description:
    "Book live public football sessions and recurring coaching subscriptions through CoachFlow.",
};

export default function BookPage() {
  const defaultCoachSlug = process.env.NEXT_PUBLIC_BOOKING_COACH_SLUG?.trim();
  const defaultAcademySlug = process.env.NEXT_PUBLIC_BOOKING_ACADEMY_SLUG?.trim();

  if (defaultCoachSlug) {
    redirect(`/book/${defaultCoachSlug}`);
  }
  if (defaultAcademySlug) {
    redirect(`/academy/${defaultAcademySlug}/book`);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <div className="glass-panel rounded-3xl p-8 sm:p-10">
        <h1 className="text-3xl font-semibold tracking-tight">Choose a booking portal</h1>
        <p className="text-muted mt-3 text-sm leading-relaxed">
          CoachFlow booking portals are now tenant-specific. Open a coach route like
          `/book/your-coach-slug` or an academy route like `/academy/your-academy-slug/book`.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="bg-foreground text-background inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
