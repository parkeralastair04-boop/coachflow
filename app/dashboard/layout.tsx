import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AcademyBrandShell } from "@/components/academy-brand-shell";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAcademyForUser } from "@/lib/academy";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { privateRouteMetadata } from "@/lib/private-route-metadata";
import {
  FEATURE_KEYS,
  getCurrentSubscription,
  planHasFeature,
} from "@/lib/subscription";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

export const metadata: Metadata = {
  ...privateRouteMetadata,
  title: "Dashboard",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseUrl || !supabaseAnonKey) {
    redirect("/login?next=/dashboard");
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/dashboard");
  }

  // Academy + subscription share cached getAuthenticatedUser / getServerSupabase.
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
        userEmail={subscription?.email ?? user.email ?? null}
        isFounder={subscription?.isFounder ?? false}
        isBetaTester={subscription?.isBetaTester ?? false}
      >
        {children}
      </DashboardShell>
    </AcademyBrandShell>
  );
}
