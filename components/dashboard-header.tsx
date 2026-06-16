"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { readClientComplimentaryAccess } from "@/lib/complimentary-access-client";

export function DashboardHeader() {
  const [label, setLabel] = useState<string>("");
  const [showFounderBadge, setShowFounderBadge] = useState(false);
  const [showBetaBadge, setShowBetaBadge] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        const email = data.user?.email;
        if (!cancelled && email) {
          setLabel(email);
          const access = await readClientComplimentaryAccess(supabase);
          setShowFounderBadge(access.isFounder);
          setShowBetaBadge(access.isBetaTester);
        } else if (!cancelled) {
          setLabel("Coach");
          setShowFounderBadge(false);
          setShowBetaBadge(false);
        }
      } catch {
        if (!cancelled) {
          setLabel("");
          setShowFounderBadge(false);
          setShowBetaBadge(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
        {showFounderBadge ? (
          <span className="bg-accent/12 text-accent ring-accent/25 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1">
            Founder • Academy
          </span>
        ) : null}
        {showBetaBadge ? (
          <span className="bg-violet-500/12 text-violet-700 ring-violet-500/25 dark:text-violet-300 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1">
            <Sparkles className="size-3.5" aria-hidden />
            Beta Tester
          </span>
        ) : null}
      </div>
      <p className="text-muted mt-1 text-sm">
        {label ? `Signed in as ${label}` : "Signed in"}
      </p>
    </div>
  );
}
