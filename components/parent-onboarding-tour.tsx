"use client";

import { useState } from "react";
import {
  Bell,
  CalendarDays,
  CreditCard,
  FileText,
  MessageSquare,
  UserCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { PARENT_ONBOARDING_METADATA_KEY } from "@/lib/parent-journey-types";

const STEPS = [
  {
    title: "Upcoming training",
    body: "See what is booked next and add sessions to your calendar.",
    icon: CalendarDays,
  },
  {
    title: "Attendance",
    body: "See recent attendance so you know how training is going.",
    icon: UserCheck,
  },
  {
    title: "Reports",
    body: "Only reports your coach intentionally shares appear here.",
    icon: FileText,
  },
  {
    title: "Payments",
    body: "Review packages and open Stripe to update payment details.",
    icon: CreditCard,
  },
  {
    title: "Messages",
    body: "Coach emails and updates stay linked to this parent account.",
    icon: MessageSquare,
  },
  {
    title: "Notifications",
    body: "Choose reminder preferences in Manage family when you are ready.",
    icon: Bell,
  },
] as const;

export function ParentOnboardingTour({ onComplete }: { onComplete: () => void }) {
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const step = STEPS[index]!;
  const Icon = step.icon;
  const isLast = index === STEPS.length - 1;

  async function finish() {
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase.auth.updateUser({
        data: { [PARENT_ONBOARDING_METADATA_KEY]: true },
      });
    } catch {
      // Still dismiss UI if metadata write fails.
    } finally {
      setSaving(false);
      onComplete();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="parent-onboarding-title"
    >
      <div className="bg-background w-full max-w-md rounded-2xl p-6 shadow-xl">
        <p className="text-muted text-xs font-medium uppercase tracking-wide">
          Before training · {index + 1} of {STEPS.length}
        </p>
        <div className="mt-4 flex items-start gap-3">
          <div className="bg-accent/15 text-accent flex size-10 shrink-0 items-center justify-center rounded-xl">
            <Icon className="size-5" aria-hidden />
          </div>
          <div>
            <h2 id="parent-onboarding-title" className="text-lg font-semibold tracking-tight">
              {step.title}
            </h2>
            <p className="text-muted mt-2 text-sm leading-relaxed">{step.body}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-between gap-2">
          <button
            type="button"
            onClick={() => void finish()}
            disabled={saving}
            className="text-muted hover:text-foreground inline-flex min-h-11 items-center px-2 text-sm"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {index > 0 ? (
              <button
                type="button"
                onClick={() => setIndex((value) => value - 1)}
                className="border-border inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-medium"
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (isLast) void finish();
                else setIndex((value) => value + 1);
              }}
              className="bg-accent text-accent-foreground hover:bg-accent/90 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-medium disabled:opacity-60"
            >
              {isLast ? "Got it" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
