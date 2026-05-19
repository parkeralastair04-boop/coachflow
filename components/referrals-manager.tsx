"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Gift, Loader2, Mail, Share2, TrendingUp, Users } from "lucide-react";
import { SetupRequiredPanel } from "@/components/setup-required-panel";
import { getSetupRequiredMessage } from "@/lib/supabase-errors";

type ReferralRow = {
  id: string;
  status: "invited" | "signed_up" | "converted";
  reward_type: string | null;
  reward_value: number;
  created_at: string;
};

type ReferralPayload = {
  setupRequired?: boolean;
  setupTables?: string[];
  referralCode?: string;
  referralUrl?: string;
  metrics?: {
    invitationsSent: number;
    signupsReferred: number;
    paidConversions: number;
    rewardsEarned: number;
  };
  referrals?: ReferralRow[];
  error?: string;
};

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "An unexpected error occurred.";
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
}) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-muted text-sm font-medium">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="text-muted mt-1 text-xs">{hint}</p>
        </div>
        <div className="bg-accent/10 ring-accent/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
          <Icon className="text-accent size-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}

export function ReferralsManager() {
  const [data, setData] = useState<ReferralPayload | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [setupTables, setSetupTables] = useState<string[]>([]);

  const loadReferrals = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSetupTables([]);
    try {
      const response = await fetch("/api/referrals");
      const payload = (await response.json()) as ReferralPayload;
      if (payload.setupRequired && payload.setupTables?.length) {
        setSetupTables(payload.setupTables);
        setData(payload);
        return;
      }
      if (!response.ok) {
        setError(payload.error ?? "Unable to load referrals.");
        return;
      }
      setData(payload);
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      await loadReferrals();
    }

    void init();
  }, [loadReferrals]);

  async function copyReferralLink() {
    if (!data?.referralUrl) return;
    try {
      await navigator.clipboard.writeText(data.referralUrl);
      setCopied(true);
      setSuccess("Referral link copied.");
    } catch {
      setError("Could not copy referral link.");
    }
  }

  async function sendInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/referrals/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not send invite.");
        return;
      }
      setInviteEmail("");
      setSuccess("Referral invite sent.");
      await loadReferrals();
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSending(false);
    }
  }

  const metrics = data?.metrics;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Referrals
        </h1>
        <p className="text-muted mt-1 max-w-2xl text-sm">
          Invite other football coaches to CoachFlow. When a referred coach
          becomes a paying customer, you earn one free month of Pro or equivalent
          account credit.
        </p>
      </div>

      {setupTables.length > 0 ? (
        <SetupRequiredPanel
          {...getSetupRequiredMessage(setupTables)}
          tables={setupTables}
        />
      ) : null}

      {error ? (
        <div className="glass-panel rounded-2xl p-5 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="glass-panel rounded-2xl p-5 text-sm text-accent">
          {success}
        </div>
      ) : null}

      {loading ? (
        <div className="glass-panel flex items-center gap-3 rounded-2xl p-6 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading referrals...
        </div>
      ) : null}

      {!loading && data && setupTables.length === 0 ? (
        <>
          <section className="glass-panel rounded-2xl p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <div className="bg-accent/10 ring-accent/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
                <Share2 className="text-accent size-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold tracking-tight">
                  Your referral link
                </h2>
                <p className="text-muted mt-1 text-sm">
                  Code: <span className="text-foreground font-medium">{data.referralCode}</span>
                </p>
                <p className="text-muted mt-4 break-all rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
                  {data.referralUrl}
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void copyReferralLink()}
                    className="bg-foreground text-background hover:opacity-90 inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity"
                  >
                    <Copy className="mr-2 size-4" aria-hidden />
                    {copied ? "Copied" : "Copy referral link"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Invitations sent"
              value={String(metrics?.invitationsSent ?? 0)}
              hint="Email invites tracked"
              icon={Mail}
            />
            <StatCard
              label="Signups referred"
              value={String(metrics?.signupsReferred ?? 0)}
              hint="New coaches attributed"
              icon={Users}
            />
            <StatCard
              label="Paid conversions"
              value={String(metrics?.paidConversions ?? 0)}
              hint="Became paying customers"
              icon={TrendingUp}
            />
            <StatCard
              label="Rewards earned"
              value={`${metrics?.rewardsEarned ?? 0} mo`}
              hint="Pro months / credit"
              icon={Gift}
            />
          </section>

          <section className="glass-panel rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-semibold tracking-tight">
              Share by email
            </h2>
            <p className="text-muted mt-1 text-sm">
              Send a branded CoachFlow invite and count it as an invitation.
            </p>
            <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={sendInvite}>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="coach@example.com"
                className="border-border bg-background text-foreground focus:ring-accent/40 h-11 min-w-0 flex-1 rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
              />
              <button
                type="submit"
                disabled={sending}
                className="bg-accent text-white hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60"
              >
                {sending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Sending...
                  </>
                ) : (
                  "Send invite"
                )}
              </button>
            </form>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">
              Referral activity
            </h2>
            {(data.referrals ?? []).length === 0 ? (
              <div className="glass-panel rounded-2xl p-6 text-sm text-muted">
                No referral activity yet.
              </div>
            ) : (
              <div className="grid gap-3">
                {(data.referrals ?? []).map((referral) => (
                  <article
                    key={referral.id}
                    className="glass-panel flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium capitalize">
                        {referral.status.replace("_", " ")}
                      </p>
                      <p className="text-muted mt-1 text-xs">
                        {formatDate(referral.created_at)}
                      </p>
                    </div>
                    <div className="text-muted text-sm">
                      Reward: {referral.reward_value}{" "}
                      {referral.reward_type === "pro_month" ? "Pro month" : "credit"}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
