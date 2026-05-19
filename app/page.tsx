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
import { DashboardPreviewMockup } from "@/components/dashboard-preview-mockup";
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
        <section className="mesh-gradient relative overflow-hidden border-border border-b px-4 pt-16 pb-20 sm:px-6 sm:pt-20 lg:px-8 lg:pt-28">
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
                className="border-border text-foreground hover:bg-surface-hover inline-flex h-12 items-center justify-center rounded-full border px-8 text-sm font-medium transition-colors"
              >
                Sign in
              </Link>
            </div>
            <DashboardPreviewMockup />
          </div>
        </section>

        <section
          id="features"
          className="border-border scroll-mt-20 border-b px-4 py-20 sm:px-6 lg:px-8"
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
          className="border-border scroll-mt-20 border-b px-4 py-20 sm:px-6 lg:px-8"
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
