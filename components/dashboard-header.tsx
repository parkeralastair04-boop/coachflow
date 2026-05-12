"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { isFounder } from "@/lib/founders";

export function DashboardHeader() {
  const [label, setLabel] = useState<string>("");
  const [founder, setFounder] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        const email = data.user?.email;
        if (!cancelled && email) {
          setLabel(email);
          setFounder(isFounder(email));
        } else if (!cancelled) {
          setLabel("Coach");
          setFounder(false);
        }
      } catch {
        if (!cancelled) {
          setLabel("");
          setFounder(false);
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
        {founder ? (
          <span className="bg-accent/12 text-accent ring-accent/25 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1">
            Founder • Academy
          </span>
        ) : null}
      </div>
      <p className="text-muted mt-1 text-sm">
        {label ? `Signed in as ${label}` : "Signed in"}
      </p>
    </div>
  );
}
