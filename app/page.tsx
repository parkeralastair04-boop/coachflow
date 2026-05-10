import Link from "next/link";
import {
  CalendarCheck,
  ClipboardCheck,
  CreditCard,
  Sparkles,
  Users,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { FeatureCard } from "@/components/feature-card";
import { PricingCard } from "@/components/pricing-card";
import { BILLING_PLANS } from "@/lib/billing";

const features = [
  {
    icon: CalendarCheck,
    title: "Online bookings",
    description:
      "Let parents book trials and term blocks in seconds with availability you control.",
  },
  {
    icon: Users,
    title: "Parent CRM",
    description:
      "One profile per family, communication history, and consent in a single view.",
  },
  {
    icon: ClipboardCheck,
    title: "Attendance tracking",
    description:
      "Mark rolls fast on mobile, spot no-shows early, and sync stats to each player.",
  },
  {
    icon: CreditCard,
    title: "Automated payments",
    description:
      "Subscriptions, instalments, and reminders so cashflow matches your schedule.",
  },
  {
    icon: Sparkles,
    title: "AI progress reports",
    description:
      "Turn session notes into parent-ready summaries with tone and detail you trust.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="flex-1">
        <section className="mesh-gradient relative overflow-hidden border-b border-black/[0.06] px-4 pt-16 pb-20 dark:border-white/[0.08] sm:px-6 sm:pt-20 lg:px-8 lg:pt-28">
          <div className="mx-auto max-w-6xl">
            <p className="text-accent mb-4 text-sm font-medium tracking-wide uppercase">
              CoachFlow
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl sm:leading-[1.08] lg:text-6xl">
              The operating system for football coaching businesses.
            </h1>
            <p className="text-muted mt-6 max-w-xl text-lg leading-relaxed">
              Run bookings, parents, attendance, and revenue from one calm,
              fast workspace — so you spend less time on admin and more on the
              pitch.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/signup"
                className="bg-foreground text-background hover:opacity-90 inline-flex h-12 items-center justify-center rounded-full px-8 text-sm font-medium shadow-sm transition-opacity"
              >
                Start free trial
              </Link>
              <Link
                href="/login"
                className="border-border text-foreground hover:bg-black/[0.03] inline-flex h-12 items-center justify-center rounded-full border px-8 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]"
              >
                Sign in
              </Link>
            </div>
            <div className="glass-panel mt-16 overflow-hidden rounded-2xl p-4 sm:p-6">
              <div className="from-accent/8 via-transparent to-accent/5 relative aspect-[21/9] min-h-[200px] rounded-xl bg-gradient-to-br ring-1 ring-black/[0.06] dark:ring-white/[0.08]">
                <div className="absolute inset-4 rounded-lg border border-dashed border-black/[0.08] dark:border-white/[0.12]" />
                <p className="text-muted absolute bottom-6 left-6 text-xs sm:text-sm">
                  Dashboard preview · Connect Supabase to enable live auth and
                  data.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="scroll-mt-20 border-b border-black/[0.06] px-4 py-20 dark:border-white/[0.08] sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-6xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything you need to run the club
            </h2>
            <p className="text-muted mt-3 max-w-2xl text-lg">
              Opinionated workflows for grassroots and academy programmes — without
              the spreadsheet chaos.
            </p>
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <FeatureCard key={f.title} {...f} />
              ))}
            </div>
          </div>
        </section>

        <section
          id="pricing"
          className="scroll-mt-20 border-b border-black/[0.06] px-4 py-20 dark:border-white/[0.08] sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-6xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Simple pricing
            </h2>
            <p className="text-muted mt-3 max-w-2xl text-lg">
              Scale as you grow. All plans include core CRM and attendance.
            </p>
            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {BILLING_PLANS.map((plan) => (
                <PricingCard
                  key={plan.id}
                  name={plan.name}
                  price={plan.price}
                  description={plan.description}
                  features={plan.features}
                  highlighted={plan.highlighted}
                  ctaHref="/pricing"
                  ctaLabel="See plans"
                />
              ))}
            </div>
          </div>
        </section>

        <section className="mesh-gradient px-4 py-20 sm:px-6 lg:px-8">
          <div className="glass-panel mx-auto max-w-4xl rounded-3xl p-10 text-center sm:p-14">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to run CoachFlow?
            </h2>
            <p className="text-muted mx-auto mt-3 max-w-lg text-base">
              Join coaches who swapped fragmented tools for one Stripe-grade
              experience built for football.
            </p>
            <Link
              href="/signup"
              className="bg-accent text-background hover:opacity-90 mt-8 inline-flex h-12 items-center justify-center rounded-full px-10 text-sm font-semibold text-white shadow-sm transition-opacity"
            >
              Get started — start trial
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
