import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import {
  DemoEnterButton,
  DemoResetButton,
} from "@/components/demo-mode-banner";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_ACADEMY_SLUG } from "@/lib/demo/constants";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

const PATHS = [
  {
    title: "Coach command centre",
    description: "Active Squad, training, development reports, bookings, and insights — with a guided tour.",
    href: "/demo/dashboard",
  },
  {
    title: "Public academy website",
    description: "Branded home, about, camps, news, contact, and booking flow.",
    href: `/academy/${DEMO_ACADEMY_SLUG}`,
  },
  {
    title: "Parent view",
    description: "What parents see after claiming access.",
    href: "/demo/dashboard/family",
  },
];

export default function DemoHubPage() {
  return (
    <main className="mesh-gradient mx-auto min-h-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <BrandLogo size="auth" />
      <p className="text-muted mt-6 text-sm font-medium uppercase tracking-wide">
        Live academy walkthrough
      </p>
      <h1 className={cn(TYPE.pageTitle, "mt-2")}>Riverside United Academy</h1>
      <p className={cn(TYPE.description, "mt-3 max-w-2xl")}>
        A fully populated Awarix academy — thriving squads, realistic bookings, shared
        development reports, and a public website. Demo mode never sends email, never charges Stripe,
        and never writes to customer data.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <DemoEnterButton />
        <Link
          href={`/academy/${DEMO_ACADEMY_SLUG}`}
          className={buttonVariants({ variant: "secondary" })}
        >
          View public website
        </Link>
        <DemoResetButton />
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {PATHS.map((path) => (
          <Link key={path.href} href={path.href} className="block">
            <Card variant="interactive" className="h-full">
              <CardHeader>
                <CardTitle>{path.title}</CardTitle>
                <CardDescription>{path.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
      <p className="text-muted mt-10 text-xs leading-relaxed">
        Reset clears tour dismissal and re-enters demo mode so every reviewer sees a clean
        experience. See <code className="text-foreground">docs/demo-mode.md</code> for
        architecture and safety details.
      </p>
    </main>
  );
}
