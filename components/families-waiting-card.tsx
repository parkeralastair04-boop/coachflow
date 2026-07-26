"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { countWaitlistChildren } from "@/lib/revenue-at-risk";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function FamiliesWaitingCard({ className }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [waitlistChildren, setWaitlistChildren] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const { data: bookings } = await supabase
          .from("session_bookings")
          .select("booking_status")
          .eq("coach_id", user.id);

        if (cancelled) return;
        setWaitlistChildren(countWaitlistChildren(bookings ?? []));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || waitlistChildren === 0) {
    return null;
  }

  return (
    <section
      className={cn("glass-panel interactive-surface rounded-2xl p-6", className)}
      aria-labelledby="families-waiting-heading"
    >
      <h2 id="families-waiting-heading" className="text-lg font-semibold tracking-tight">
        Families waiting for places
      </h2>
      <p
        className="mt-2 text-3xl font-semibold tracking-tight"
        role="status"
        aria-live="polite"
      >
        {waitlistChildren}
      </p>
      <p className="text-muted mt-1 text-sm leading-relaxed">
        {waitlistChildren === 1
          ? "1 family is waiting for a place."
          : `${waitlistChildren} families are waiting for places.`}
      </p>
      <p className="text-muted mt-2 text-sm leading-relaxed">
        Adding another session could help.
      </p>
      <Link
        href="/dashboard/sessions"
        className="text-accent mt-4 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
      >
        View sessions
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </section>
  );
}
