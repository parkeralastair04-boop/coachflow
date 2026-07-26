"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  formatWaitingFamiliesCopy,
} from "@/lib/coaching-income";
import { countWaitlistChildren } from "@/lib/revenue-at-risk";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function FamiliesWaitingPanel({ className }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [familiesWaiting, setFamiliesWaiting] = useState(0);

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

        setFamiliesWaiting(countWaitlistChildren(bookings ?? []));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return null;
  }

  if (familiesWaiting <= 0) {
    return null;
  }

  return (
    <section
      className={cn("glass-panel interactive-surface rounded-2xl p-5 text-sm", className)}
      aria-labelledby="families-waiting-heading"
      role="status"
      aria-live="polite"
    >
      <h2 id="families-waiting-heading" className="sr-only">
        Families waiting for places
      </h2>
      <p className="font-medium">{formatWaitingFamiliesCopy(familiesWaiting)}</p>
      <p className="text-muted mt-1 leading-relaxed">Adding another session could help.</p>
      <Link
        href="/dashboard/sessions"
        className="text-accent focus-visible:ring-accent/50 mt-4 inline-flex min-h-11 items-center gap-1.5 font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        See details
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </section>
  );
}
