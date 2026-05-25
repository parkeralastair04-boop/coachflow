"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  Mail,
  Phone,
  PoundSterling,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { FeatureInfoTooltip } from "@/components/feature-info-tooltip";
import { cn } from "@/lib/utils";

type BillingInterval = "monthly" | "weekly";

type ParentPlayer = {
  id: string;
  player_name: string;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
};

type ParentSubscription = {
  id: string;
  coach_id: string;
  academy_id: string | null;
  player_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  amount: number;
  currency: string;
  interval: BillingInterval | null;
  status: string;
  current_period_end: string | null;
  subscription_kind: "manual" | "recurring_series";
  recurring_series_id: string | null;
  recurring_enrolment_id: string | null;
  recurring_series?: { title: string | null } | { title: string | null }[] | null;
  created_at: string;
};

type PaymentsResponse = {
  players?: ParentPlayer[];
  subscriptions?: ParentSubscription[];
  error?: string;
};

const failedStatuses = new Set([
  "past_due",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "canceled",
]);

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDate(value: string | null): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(parsed);
}

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

function statusTone(status: string): string {
  if (status === "active" || status === "trialing") {
    return "bg-accent/10 text-accent ring-accent/25";
  }
  if (status === "customer_created") {
    return "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300";
  }
  if (failedStatuses.has(status)) {
    return "bg-red-500/10 text-red-700 ring-red-500/25 dark:text-red-300";
  }
  return "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300";
}

function isOverdue(subscription: ParentSubscription): boolean {
  if (failedStatuses.has(subscription.status)) return true;
  if (!subscription.current_period_end) return false;
  return (
    new Date(subscription.current_period_end).getTime() < Date.now() &&
    subscription.status !== "active"
  );
}

function getSeriesTitle(subscription: ParentSubscription): string | null {
  if (!subscription.recurring_series) return null;
  return Array.isArray(subscription.recurring_series)
    ? subscription.recurring_series[0]?.title ?? null
    : subscription.recurring_series.title ?? null;
}

export function PaymentsManager() {
  const [players, setPlayers] = useState<ParentPlayer[]>([]);
  const [subscriptions, setSubscriptions] = useState<ParentSubscription[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [amount, setAmount] = useState("49.00");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingCustomerId, setCreatingCustomerId] = useState<string | null>(null);
  const [creatingSubscription, setCreatingSubscription] = useState(false);
  const [creatingCheckoutLink, setCreatingCheckoutLink] = useState(false);
  const [sendingCheckoutLink, setSendingCheckoutLink] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [copiedCheckoutLink, setCopiedCheckoutLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedPlayer = useMemo(
    () => players.find((player) => player.id === selectedPlayerId) ?? null,
    [players, selectedPlayerId],
  );

  const loadPayments = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/payments/list-subscriptions");
      const payload = (await response.json()) as PaymentsResponse;
      if (!response.ok) {
        setError(payload.error ?? "Unable to load parent payments.");
        return;
      }

      const nextPlayers = payload.players ?? [];
      setPlayers(nextPlayers);
      setSubscriptions(payload.subscriptions ?? []);
      setSelectedPlayerId((current) => current || nextPlayers[0]?.id || "");
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      await loadPayments();
    }

    void init();
  }, [loadPayments]);

  async function createCustomer(playerId: string) {
    setCreatingCustomerId(playerId);
    setSuccess(null);
    setError(null);
    try {
      const response = await fetch("/api/payments/create-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const payload = (await response.json()) as {
        customerId?: string;
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "Could not create Stripe customer.");
        return;
      }
      setSuccess("Stripe customer created for parent.");
      await loadPayments(true);
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setCreatingCustomerId(null);
    }
  }

  async function createSubscription() {
    if (!selectedPlayerId) {
      setError("Please choose a player.");
      return;
    }

    const amountInPence = Math.round(Number.parseFloat(amount) * 100);
    if (!Number.isFinite(amountInPence) || amountInPence < 100) {
      setError("Enter a valid amount of at least £1.00.");
      return;
    }

    setCreatingSubscription(true);
    setSuccess(null);
    setError(null);
    try {
      const response = await fetch("/api/payments/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: selectedPlayerId,
          amount: amountInPence,
          interval,
        }),
      });
      const payload = (await response.json()) as {
        subscription?: ParentSubscription;
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "Could not create subscription.");
        return;
      }
      setSuccess("Subscription created and assigned to player.");
      await loadPayments(true);
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setCreatingSubscription(false);
    }
  }

  function validateCheckoutInput() {
    if (!selectedPlayerId) {
      setError("Please choose a player.");
      return null;
    }

    const amountInPence = Math.round(Number.parseFloat(amount) * 100);
    if (!Number.isFinite(amountInPence) || amountInPence < 100) {
      setError("Enter a valid amount of at least £1.00.");
      return null;
    }

    return amountInPence;
  }

  async function createCheckoutLink(sendEmail = false) {
    const amountInPence = validateCheckoutInput();
    if (!amountInPence) return;

    if (sendEmail) setSendingCheckoutLink(true);
    else setCreatingCheckoutLink(true);
    setSuccess(null);
    setError(null);
    setCopiedCheckoutLink(false);

    try {
      const response = await fetch("/api/payments/create-checkout-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: selectedPlayerId,
          amount: amountInPence,
          interval,
          sendEmail,
        }),
      });
      const payload = (await response.json()) as {
        url?: string;
        emailed?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.url) {
        setError(payload.error ?? "Could not create checkout link.");
        return;
      }

      setCheckoutUrl(payload.url);
      setSuccess(
        payload.emailed
          ? "Checkout link created and emailed to parent."
          : "Checkout link created.",
      );
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setCreatingCheckoutLink(false);
      setSendingCheckoutLink(false);
    }
  }

  async function copyCheckoutLink() {
    if (!checkoutUrl) return;
    try {
      await navigator.clipboard.writeText(checkoutUrl);
      setCopiedCheckoutLink(true);
      setSuccess("Checkout link copied.");
    } catch {
      setError("Could not copy checkout link. Please copy it manually.");
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Parent payments
            </h1>
            <FeatureInfoTooltip featureKey="payments" />
          </div>
          <p className="text-muted mt-1 text-sm">
            Create parent Stripe customers, assign recurring subscriptions to
            players, and spot failed payments quickly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadPayments(true)}
          disabled={loading || refreshing}
          className="border-border hover:bg-black/[0.03] inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors disabled:opacity-60 dark:hover:bg-white/[0.06]"
        >
          {refreshing ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="mr-2 size-4" aria-hidden />
          )}
          Refresh
        </button>
      </div>

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

      <section className="glass-panel rounded-2xl p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="bg-accent/10 ring-accent/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
            <PoundSterling className="text-accent size-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Create subscription
            </h2>
            <p className="text-muted mt-1 text-sm">
              Choose a player, billing cadence, and custom amount. Stripe will
              create recurring invoices for the parent customer.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className="mb-2 block text-sm font-medium" htmlFor="playerId">
              Player
            </label>
            <select
              id="playerId"
              value={selectedPlayerId}
              disabled={loading || players.length === 0}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 disabled:opacity-70 dark:ring-offset-background"
            >
              {players.length === 0 ? (
                <option value="">No players available</option>
              ) : null}
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.player_name}
                  {player.parent_email ? ` — ${player.parent_email}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="interval">
              Billing interval
            </label>
            <select
              id="interval"
              value={interval}
              onChange={(e) => setInterval(e.target.value as BillingInterval)}
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="amount">
              Custom amount (£)
            </label>
            <input
              id="amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
              placeholder="49.00"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              disabled={creatingSubscription || !selectedPlayer}
              onClick={() => void createSubscription()}
              className="bg-foreground text-background hover:opacity-90 inline-flex h-11 w-full items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60"
            >
              {creatingSubscription ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Creating...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 size-4" aria-hidden />
                  Create Subscription
                </>
              )}
            </button>
          </div>
        </div>

        {selectedPlayer ? (
          <div className="text-muted mt-5 rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
            Parent:{" "}
            <span className="text-foreground font-medium">
              {selectedPlayer.parent_name ?? "N/A"}
            </span>{" "}
            · Email:{" "}
            <span className="text-foreground font-medium">
              {selectedPlayer.parent_email ?? "Missing"}
            </span>
          </div>
        ) : null}
      </section>

      <section className="glass-panel rounded-2xl p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="bg-accent/10 ring-accent/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
            <ExternalLink className="text-accent size-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Create Payment Link
            </h2>
            <p className="text-muted mt-1 text-sm">
              Generate a secure Stripe Checkout URL parents can open to add
              their payment method and start recurring payments.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void createCheckoutLink(false)}
            disabled={creatingCheckoutLink || sendingCheckoutLink || !selectedPlayer}
            className="bg-accent text-white hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60"
          >
            {creatingCheckoutLink ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Creating...
              </>
            ) : (
              <>
                <ExternalLink className="mr-2 size-4" aria-hidden />
                Create Payment Link
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => void createCheckoutLink(true)}
            disabled={
              creatingCheckoutLink ||
              sendingCheckoutLink ||
              !selectedPlayer?.parent_email
            }
            className="border-border hover:bg-black/[0.03] inline-flex h-11 items-center justify-center rounded-full border px-6 text-sm font-medium transition-colors disabled:opacity-60 dark:hover:bg-white/[0.06]"
          >
            {sendingCheckoutLink ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 size-4" aria-hidden />
                Send by Email
              </>
            )}
          </button>
        </div>

        {checkoutUrl ? (
          <div className="mt-5 rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
            <p className="text-muted break-all text-sm">{checkoutUrl}</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void copyCheckoutLink()}
                className="border-border hover:bg-black/[0.03] inline-flex h-10 items-center justify-center rounded-full border px-5 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]"
              >
                <Copy className="mr-2 size-4" aria-hidden />
                {copiedCheckoutLink ? "Copied" : "Copy Link"}
              </button>
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-foreground text-background hover:opacity-90 inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity"
              >
                <ExternalLink className="mr-2 size-4" aria-hidden />
                Open Link
              </a>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Players & parents
          </h2>
          {!loading ? (
            <span className="text-muted text-sm">{players.length} players</span>
          ) : null}
        </div>

        {loading ? (
          <div className="glass-panel flex items-center gap-3 rounded-2xl p-6 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading parent payments...
          </div>
        ) : null}

        {!loading && players.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center">
            <UserRound className="text-muted mx-auto size-8" aria-hidden />
            <p className="mt-3 font-medium">No players yet</p>
            <p className="text-muted mt-1 text-sm">
              Add players with parent details before creating payment plans.
            </p>
          </div>
        ) : null}

        {!loading && players.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {players.map((player) => {
              const playerSubscriptions = subscriptions.filter(
                (subscription) => subscription.player_id === player.id,
              );
              const latestSubscription = playerSubscriptions[0];
              const hasCustomer = playerSubscriptions.some(
                (subscription) => subscription.stripe_customer_id,
              );

              return (
                <article
                  key={player.id}
                  className="glass-panel rounded-2xl p-5 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight">
                        {player.player_name}
                      </h3>
                      <p className="text-muted mt-1 text-sm">
                        {player.parent_name ?? "No parent name"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void createCustomer(player.id)}
                      disabled={
                        creatingCustomerId === player.id ||
                        !player.parent_email ||
                        hasCustomer
                      }
                      className="border-border hover:bg-black/[0.03] inline-flex h-9 items-center justify-center rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-60 dark:hover:bg-white/[0.06]"
                    >
                      {creatingCustomerId === player.id ? (
                        <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden />
                      ) : null}
                      {hasCustomer ? "Customer ready" : "Create customer"}
                    </button>
                  </div>

                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="text-muted size-3.5" aria-hidden />
                      <dd>{player.parent_email ?? "Missing parent email"}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="text-muted size-3.5" aria-hidden />
                      <dd>{player.parent_phone ?? "No phone"}</dd>
                    </div>
                  </dl>

                  {latestSubscription ? (
                    <div className="mt-5 rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                            statusTone(latestSubscription.status),
                          )}
                        >
                          {latestSubscription.status}
                        </span>
                        {isOverdue(latestSubscription) ? (
                          <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-500/25 dark:text-red-300">
                            <AlertTriangle
                              className="mr-1 size-3"
                              aria-hidden
                            />
                            overdue / failed
                          </span>
                        ) : null}
                        <span className="border-border text-muted inline-flex rounded-full border px-2.5 py-1 text-xs font-medium">
                          {latestSubscription.subscription_kind === "recurring_series"
                            ? "Series-backed"
                            : "Manual"}
                        </span>
                      </div>
                      {latestSubscription.subscription_kind === "recurring_series" ? (
                        <p className="text-muted mt-3 text-xs">
                          {getSeriesTitle(latestSubscription) ?? "Recurring coaching series"}
                        </p>
                      ) : null}
                      <dl className="mt-4 grid grid-cols-2 gap-3">
                        <div>
                          <dt className="text-muted text-xs">Amount</dt>
                          <dd className="mt-1 font-medium">
                            {formatMoney(
                              latestSubscription.amount,
                              latestSubscription.currency,
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted text-xs">Interval</dt>
                          <dd className="mt-1 font-medium capitalize">
                            {latestSubscription.interval ?? "N/A"}
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-muted text-xs">Next payment</dt>
                          <dd className="mt-1 font-medium">
                            {formatDate(latestSubscription.current_period_end)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ) : (
                    <p className="text-muted mt-5 rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
                      No subscription assigned yet.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
