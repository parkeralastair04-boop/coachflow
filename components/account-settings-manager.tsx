"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { readClientComplimentaryAccess } from "@/lib/complimentary-access-client";
import type { ComplimentaryAccess } from "@/lib/complimentary-access";
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

function parsePlanId(value: unknown): PlanId | null {
  if (value === "starter" || value === "pro" || value === "academy") {
    return value;
  }
  return null;
}

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

        const complimentary = await readClientComplimentaryAccess(supabase);

        if (!cancelled) {
          setProfile({
            email: user.email,
            fullName:
              typeof user.user_metadata?.full_name === "string"
                ? user.user_metadata.full_name
                : null,
            subscriptionPlan: parsePlanId(user.user_metadata?.subscription_plan),
            subscriptionStatus:
              typeof user.user_metadata?.subscription_status === "string"
                ? user.user_metadata.subscription_status
                : null,
            complimentary,
          });
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("Account settings could not be loaded.");
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
    return (
      <div className="text-muted flex min-h-[40vh] items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading account settings...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Account Settings</h1>
        </div>
        <p className="text-sm text-red-600 dark:text-red-400">{error ?? "Account unavailable."}</p>
      </div>
    );
  }

  const effectivePlanLabel = profile.complimentary.hasComplimentaryAccess
    ? "Academy"
    : getPlanDisplayName(profile.subscriptionPlan ?? "starter");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Account Settings</h1>
        <p className="text-muted mt-1 text-sm">
          View your sign-in details and CoachFlow plan access.
        </p>
      </div>

      <section className="glass-panel rounded-2xl p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="bg-accent/10 ring-accent/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
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
                "Your CoachFlow account"
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

      <section className="glass-panel rounded-2xl p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="bg-accent/10 ring-accent/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
            <ShieldCheck className="text-accent size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight">Access & billing</h2>
            <p className="text-muted mt-1 text-sm">
              Your current CoachFlow subscription tier and any complimentary access.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {profile.complimentary.isFounder ? (
            <span className="bg-accent/12 text-accent ring-accent/25 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1">
              Founder • Academy
            </span>
          ) : null}
          {profile.complimentary.isBetaTester ? (
            <span className="bg-violet-500/12 text-violet-700 ring-violet-500/25 dark:text-violet-300 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1">
              <Sparkles className="size-3.5" aria-hidden />
              Beta Tester
            </span>
          ) : null}
          {!profile.complimentary.hasComplimentaryAccess ? (
            <span className="border-border text-muted inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium">
              {effectivePlanLabel}
              {profile.subscriptionStatus ? ` • ${profile.subscriptionStatus}` : ""}
            </span>
          ) : null}
        </div>

        {profile.complimentary.isBetaTester ? (
          <div
            className={cn(
              "mt-6 rounded-xl border p-4",
              "border-violet-500/20 bg-violet-500/8",
            )}
          >
            <p className="text-sm font-medium text-violet-950 dark:text-violet-100">
              Complimentary Academy Access
            </p>
            <p className="text-muted mt-1 text-sm leading-relaxed">
              You are part of the CoachFlow beta programme with full Academy features enabled
              for testing. Billing and Stripe checkout are not required for your account.
            </p>
          </div>
        ) : profile.complimentary.isFounder ? (
          <div className="bg-accent/8 border-accent/20 mt-6 rounded-xl border p-4">
            <p className="text-accent text-sm font-medium">Complimentary Academy Access</p>
            <p className="text-muted mt-1 text-sm leading-relaxed">
              Founder accounts receive full Academy access without a paid subscription.
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
