import { redirect } from "next/navigation";
import { AcademyBrandShell } from "@/components/academy-brand-shell";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAcademyForUser } from "@/lib/academy";
import {
  FEATURE_KEYS,
  getCurrentSubscription,
  planHasFeature,
} from "@/lib/subscription";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseUrl || !supabaseAnonKey) {
    redirect("/login?next=/dashboard");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const [academy, subscription] = await Promise.all([
    getAcademyForUser(user.id),
    getCurrentSubscription(),
  ]);

  const effectivePlan = subscription?.effectivePlan ?? "starter";
  const enabledFeatures = FEATURE_KEYS.filter((key) =>
    planHasFeature(effectivePlan, key),
  );

  return (
    <AcademyBrandShell academy={academy}>
      <DashboardShell
        academy={academy}
        enabledFeatures={enabledFeatures}
      >
        {children}
      </DashboardShell>
    </AcademyBrandShell>
  );
}
