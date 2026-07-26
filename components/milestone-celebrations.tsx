"use client";

import { useEffect, useState } from "react";
import { PartyPopper, X } from "lucide-react";
import {
  hasSeenCelebration,
  markCelebrationSeen,
  type CelebrationKey,
} from "@/lib/activation-client";
import { fetchOnboardingCounts } from "@/lib/onboarding-setup";
import { createClient } from "@/lib/supabase";

type Milestone = {
  key: CelebrationKey;
  title: string;
  body: string;
  ready: boolean;
};

/**
 * One-time milestone celebrations persisted in Auth user_metadata.
 */
export function MilestoneCelebrations() {
  const [active, setActive] = useState<Milestone | null>(null);

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
        const counts = await fetchOnboardingCounts(supabase, user.id);

        const candidates: Milestone[] = [
          {
            key: "academy_created",
            title: "Academy page live",
            body: "Your booking page is live. Next, publish a session parents can book.",
            ready: counts.hasAcademy && !hasSeenCelebration(metadata, "academy_created"),
          },
          {
            key: "session_published",
            title: "First training live for parents",
            body: "Parents can now reserve a place. Share your booking link to get your first booking.",
            ready: counts.hasSession && !hasSeenCelebration(metadata, "session_published"),
          },
        ];

        const next = candidates.find((item) => item.ready) ?? null;
        if (!cancelled) setActive(next);
      } catch {
        // Optional UI.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function dismiss() {
    if (!active) return;
    const key = active.key;
    setActive(null);
    try {
      const supabase = createClient();
      await markCelebrationSeen(supabase, key);
    } catch {
      // Ignore.
    }
  }

  if (!active) return null;

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
          <p className="font-semibold tracking-tight">{active.title}</p>
          <p className="text-muted mt-1 text-sm leading-relaxed">{active.body}</p>
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
