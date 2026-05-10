"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

export function DashboardHeader() {
  const [label, setLabel] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!cancelled && data.user?.email) setLabel(data.user.email);
        else if (!cancelled) setLabel("Coach");
      } catch {
        if (!cancelled) setLabel("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Overview</h1>
      <p className="text-muted mt-1 text-sm">
        {label ? `Signed in as ${label}` : "Signed in"}
      </p>
    </div>
  );
}
