"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { ContentSkeleton } from "@/components/branded-loading";
import { PageHeader } from "@/components/page-header";
import { FormErrorAlert } from "@/components/form-error-alert";
import { createClient } from "@/lib/supabase";
import { sanitizeDashboardSaveError } from "@/lib/user-facing-errors";
import { readClientComplimentaryAccess } from "@/lib/complimentary-access-client";
import type { ComplimentaryAccess } from "@/lib/complimentary-access-types";
import { EMPTY_COMPLIMENTARY_ACCESS } from "@/lib/complimentary-access-types";
import { getPlanDisplayName } from "@/lib/feature-info";
import type { PlanId } from "@/lib/billing";
import { cn } from "@/lib/utils";

type AccountProfile = {
  email: string;
  fullName: string | null;
  subscriptionPlan: PlanId | null;
  subscriptionStatus: string | null;
  complimentary: ComplimentaryAccess;
};

export function AccountSettingsManager() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user?.email) {
          if (!cancelled) {
            setError("You must be signed in to view account settings.");
            setProfile(null);
          }
          return;
        }

        let complimentary: ComplimentaryAccess = EMPTY_COMPLIMENTARY_ACCESS;
        let subscriptionPlan: PlanId | null = null;
        let subscriptionStatus: string | null = null;

        try {
          const response = await fetch("/api/account/entitlements");
          if (response.ok) {
            const payload = (await response.json()) as {
              plan?: PlanId;
              status?: string;
              hasComplimentaryAccess?: boolean;
              isFounder?: boolean;
              isBetaTester?: boolean;
            };
            if (payload.plan) subscriptionPlan = payload.plan;
            if (payload.status) subscriptionStatus = payload.status;
            if (payload.hasComplimentaryAccess) {
              subscriptionPlan = "academy";
              subscriptionStatus = "active";
              complimentary = {
                plan: "academy",
                status: "active",
                isFounder: Boolean(payload.isFounder),
                isBetaTester: Boolean(payload.isBetaTester),
                hasComplimentaryAccess: true,
                accessType: payload.isFounder
                  ? "founder"
                  : payload.isBetaTester
                    ? "beta_tester"
                    : null,
              };
            }
          } else {
            // Optimistic beta-only hint when entitlements API is unavailable.
            complimentary = await readClientComplimentaryAccess(supabase);
            if (complimentary.hasComplimentaryAccess) {
              subscriptionPlan = "academy";
              subscriptionStatus = "active";
            }
          }
        } catch {
          complimentary = await readClientComplimentaryAccess(supabase);
          if (complimentary.hasComplimentaryAccess) {
            subscriptionPlan = "academy";
            subscriptionStatus = "active";
          }
        }

        if (!cancelled) {
          setProfile({
            email: user.email,
            fullName:
              typeof user.user_metadata?.full_name === "string"
                ? user.user_metadata.full_name
                : null,
            subscriptionPlan,
            subscriptionStatus,
            complimentary,
          });
          setError(null);
        }
      } catch (caughtError: unknown) {
        if (!cancelled) {
          setError(sanitizeDashboardSaveError(caughtError, { logLabel: "account-settings" }));
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <ContentSkeleton rows={3} />;
  }

  if (error || !profile) {
    return (
      <div className="space-y-4">
        <PageHeader title="Coach Profile" />
        <FormErrorAlert message={error ?? "Account settings could not be loaded."} />
      </div>
    );
  }

  const effectivePlanLabel = profile.complimentary.hasComplimentaryAccess
    ? "Academy"
    : getPlanDisplayName(profile.subscriptionPlan ?? "starter");

  return (
    <div className="page-content-enter space-y-8">
      <PageHeader
        title="Coach Profile"
        subtitle="Your sign-in details and Awarix plan."
      />

      <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="bg-accent/12 ring-accent/25 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
            <UserRound className="text-accent size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight">Profile</h2>
            <p className="text-muted mt-1 text-sm">
              {profile.fullName ? (
                <>
                  Signed in as{" "}
                  <span className="text-foreground font-medium">{profile.fullName}</span>
                </>
              ) : (
                "Your Awarix account"
              )}
            </p>
          </div>
        </div>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="border-border rounded-xl border p-4">
            <dt className="text-muted text-xs font-medium uppercase tracking-wide">Email</dt>
            <dd className="mt-2 text-sm font-medium break-all">{profile.email}</dd>
          </div>
          <div className="border-border rounded-xl border p-4">
            <dt className="text-muted text-xs font-medium uppercase tracking-wide">Plan access</dt>
            <dd className="mt-2 text-sm font-medium">{effectivePlanLabel}</dd>
          </div>
        </dl>
      </section>

      <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="bg-accent/12 ring-accent/25 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
            <ShieldCheck className="text-accent size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight">Plan & access</h2>
            <p className="text-muted mt-1 text-sm">
              Your current Awarix plan and any complimentary access.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {profile.complimentary.hasComplimentaryAccess ? (
            <span className="bg-violet-500/12 text-violet-700 ring-violet-500/25 dark:text-violet-300 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1">
              <Sparkles className="size-3.5" aria-hidden />
              Awarix member
            </span>
          ) : null}
          {!profile.complimentary.hasComplimentaryAccess ? (
            <span className="border-border text-muted inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium">
              {effectivePlanLabel}
              {profile.subscriptionStatus ? ` • ${profile.subscriptionStatus}` : ""}
            </span>
          ) : null}
        </div>

        {profile.complimentary.hasComplimentaryAccess ? (
          <div
            className={cn(
              "mt-6 rounded-xl border p-4",
              "border-violet-500/20 bg-violet-500/8",
            )}
          >
            <p className="text-sm font-medium text-violet-950 dark:text-violet-100">
              Complimentary Academy access
            </p>
            <p className="text-muted mt-1 text-sm leading-relaxed">
              You have complimentary Academy access as an Awarix member. Paid billing is not
              required for your account.
            </p>
          </div>
        ) : (
          <p className="text-muted mt-6 text-sm leading-relaxed">
            Manage billing, invoices, and plan changes from the Billing page or Pricing.
          </p>
        )}
      </section>
    </div>
  );
}
