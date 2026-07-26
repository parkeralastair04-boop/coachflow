"use client";

import { useEffect, useState } from "react";
import { PartyPopper, X } from "lucide-react";
import {
  hasSeenCelebration,
  markCelebrationSeen,
  trackActivationEvent,
} from "@/lib/activation-client";
import { fetchOnboardingCounts } from "@/lib/onboarding-setup";
import { createClient } from "@/lib/supabase";

/**
 * Celebrates the first parent booking once, persisted in user_metadata.
 */
export function FirstBookingCelebration() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const metadata = user.user_metadata as Record<string, unknown>;
        if (hasSeenCelebration(metadata, "first_booking")) return;

        const counts = await fetchOnboardingCounts(supabase, user.id);
        if (!cancelled && counts.hasBooking) {
          setVisible(true);
          void trackActivationEvent("first_booking_received");
        }
      } catch {
        // Ignore — celebration is optional.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function dismiss() {
    setVisible(false);
    try {
      const supabase = createClient();
      await markCelebrationSeen(supabase, "first_booking");
    } catch {
      // Ignore.
    }
  }

  if (!visible) return null;

  return (
    <section
      className="football-panel relative overflow-hidden rounded-2xl border border-accent/20"
      role="status"
      aria-live="polite"
    >
      <div className="from-accent/10 pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent" />
      <div className="relative flex items-start gap-3 p-5 sm:p-6">
        <div className="bg-accent/12 ring-accent/20 flex size-10 shrink-0 items-center justify-center rounded-xl ring-1">
          <PartyPopper className="text-accent size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold tracking-tight">
            First parent booked onto training!
          </p>
          <p className="text-muted mt-1 text-sm leading-relaxed">
            Your booking page is live. Check Sessions for confirmed players and any
            bookings still waiting for payment.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void dismiss()}
          className="text-muted hover:text-foreground shrink-0 rounded-lg p-1.5 transition-colors"
          aria-label="Dismiss"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
