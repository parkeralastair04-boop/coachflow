"use client";

import { useState, useSyncExternalStore } from "react";
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  FileText,
  Globe2,
  LayoutDashboard,
  Users,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_TOUR_STORAGE_KEY } from "@/lib/demo/constants";

const STEPS = [
  {
    title: "Academy Pulse",
    body: "Start here each day — players, upcoming sessions, bookings, and sample income at a glance.",
    href: "/demo/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Players",
    body: "A living squad — ages, attendance, and parent status.",
    href: "/demo/dashboard/players",
    icon: Users,
  },
  {
    title: "Sessions & bookings",
    body: "Publish group and 1:1 sessions. See confirmed, waitlist, cancelled, and completed places.",
    href: "/demo/dashboard/sessions",
    icon: CalendarDays,
  },
  {
    title: "Reports",
    body: "Technical, physical, and behavioural notes — share only when you are ready.",
    href: "/demo/dashboard/reports",
    icon: FileText,
  },
  {
    title: "Academy website",
    body: "Your public face: branding, news, camps, fixtures, and booking.",
    href: "/academy/riverside-united",
    icon: Globe2,
  },
  {
    title: "Family portal",
    body: "What parents see after claiming access — sessions, attendance, and shared reports.",
    href: "/demo/dashboard/family",
    icon: UsersRound,
  },
  {
    title: "Your Awarix plan",
    body: "Plan entitlements without live Stripe charges in demo mode.",
    href: "/demo/dashboard/billing",
    icon: CreditCard,
  },
  {
    title: "Analytics",
    body: "Sample growth metrics clearly labelled as demo data.",
    href: "/demo/dashboard/analytics",
    icon: BarChart3,
  },
] as const;

function subscribeTourStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getTourDismissedSnapshot() {
  try {
    return localStorage.getItem(DEMO_TOUR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getTourDismissedServerSnapshot() {
  return true;
}

export function DemoProductTour({
  forceOpen = false,
}: {
  forceOpen?: boolean;
}) {
  const dismissed = useSyncExternalStore(
    subscribeTourStorage,
    getTourDismissedSnapshot,
    getTourDismissedServerSnapshot,
  );
  const [replayOpen, setReplayOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const open = forceOpen || replayOpen || !dismissed;

  function dismiss() {
    try {
      localStorage.setItem(DEMO_TOUR_STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setReplayOpen(false);
    // Trigger subscribers on same tab
    window.dispatchEvent(new Event("storage"));
  }

  function replay() {
    setIndex(0);
    setReplayOpen(true);
  }

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={replay}>
        Replay tour
      </Button>
    );
  }

  const step = STEPS[index]!;
  const Icon = step.icon;
  const isLast = index === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-tour-title"
    >
      <div className="bg-background w-full max-w-md rounded-2xl p-6 shadow-xl">
        <p className="text-muted text-xs font-medium uppercase tracking-wide">
          Academy tour · {index + 1} of {STEPS.length}
        </p>
        <div className="mt-4 flex items-start gap-3">
          <div className="bg-accent/15 text-accent flex size-10 shrink-0 items-center justify-center rounded-xl">
            <Icon className="size-5" aria-hidden />
          </div>
          <div>
            <h2 id="demo-tour-title" className="text-lg font-semibold tracking-tight">
              {step.title}
            </h2>
            <p className="text-muted mt-2 text-sm leading-relaxed">{step.body}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="text-muted hover:text-foreground inline-flex min-h-11 items-center px-2 text-sm"
          >
            Dismiss
          </button>
          <div className="flex gap-2">
            {index > 0 ? (
              <Button type="button" variant="secondary" onClick={() => setIndex((i) => i - 1)}>
                Back
              </Button>
            ) : null}
            {isLast ? (
              <Button
                type="button"
                onClick={() => {
                  dismiss();
                  window.location.href = step.href;
                }}
              >
                Finish
              </Button>
            ) : (
              <Button type="button" onClick={() => setIndex((i) => i + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>
        <p className="text-muted mt-4 text-xs">
          Tip: open{" "}
          <a href={step.href} className="text-foreground underline underline-offset-2">
            {step.title}
          </a>{" "}
          anytime from the demo nav.
        </p>
      </div>
    </div>
  );
}
