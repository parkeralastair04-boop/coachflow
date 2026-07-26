"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  Mail,
  Phone,
  PoundSterling,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { Button } from "@/components/ui/button";
import { FormErrorAlert } from "@/components/form-error-alert";
import { EmptyState } from "@/components/empty-state";
import { footballEmptyPreset } from "@/lib/football-identity";
import {
  getSubscriptionStatusLabel,
  getSubscriptionStatusHelperCopy,
  PAYMENT_STATUS_HELPER_COPY,
  subscriptionNeedsAttention,
} from "@/lib/payment-status-labels";
import { isValidSubscriptionAmount } from "@/lib/validation/amounts";
import { sanitizeDashboardSaveError } from "@/lib/user-facing-errors";
import { cn } from "@/lib/utils";
import { PanelSkeleton } from "@/components/branded-loading";

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

function getSubscriptionStatusPresentation(status: string) {
  return {
    label: getSubscriptionStatusLabel(status),
    needsAttention: subscriptionNeedsAttention(status),
  };
}

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
  return sanitizeDashboardSaveError(error, { logLabel: "payments" });
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

function SubscriptionStatusIcon({ status }: { status: string }) {
  if (status === "active" || status === "trialing" || status === "customer_created") {
    return <CheckCircle2 className="mr-1 size-3 shrink-0" aria-hidden />;
  }
  if (failedStatuses.has(status)) {
    return <XCircle className="mr-1 size-3 shrink-0" aria-hidden />;
  }
  if (status === "incomplete") {
    return <Clock className="mr-1 size-3 shrink-0" aria-hidden />;
  }
  return <AlertTriangle className="mr-1 size-3 shrink-0" aria-hidden />;
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

  const paymentActionInProgress =
    creatingCustomerId !== null ||
    creatingSubscription ||
    creatingCheckoutLink ||
    sendingCheckoutLink;

  const loadPayments = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/payments/list-subscriptions");
      const payload = (await response.json()) as PaymentsResponse;
      if (!response.ok) {
        setError(sanitizeDashboardSaveError(payload.error, { logLabel: "payments-load" }));
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
        setError(
          sanitizeDashboardSaveError(payload.error, { logLabel: "payments-create-profile" }),
        );
        return;
      }
      setSuccess("Parent payment setup complete.");
      await loadPayments(true);
    } catch (caughtError: unknown) {
      setError(
        sanitizeDashboardSaveError(caughtError, { logLabel: "payments-create-profile" }),
      );
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
    if (!isValidSubscriptionAmount(amountInPence)) {
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
        setError(
          sanitizeDashboardSaveError(payload.error, { logLabel: "payments-create-subscription" }),
        );
        return;
      }
      setSuccess("Monthly payment plan created and assigned to player.");
      await loadPayments(true);
    } catch (caughtError: unknown) {
      setError(sanitizeDashboardSaveError(caughtError, { logLabel: "payments-create-subscription" }));
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
    if (!isValidSubscriptionAmount(amountInPence)) {
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
        setError(
          sanitizeDashboardSaveError(payload.error, {
            logLabel: sendEmail ? "payments-send-checkout" : "payments-create-checkout",
          }),
        );
        return;
      }

      setCheckoutUrl(payload.url);
      setSuccess(
        payload.emailed
          ? "Secure payment link created and emailed to parent."
          : "Secure payment link created.",
      );
    } catch (caughtError: unknown) {
      setError(
        sanitizeDashboardSaveError(caughtError, {
          logLabel: sendEmail ? "payments-send-checkout" : "payments-create-checkout",
        }),
      );
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
      setSuccess("Secure payment link copied.");
    } catch {
      setError("Could not copy the payment link. Please copy it manually.");
    }
  }

  return (
    <div className="page-content-enter space-y-10">
      <FeaturePageHeader
        featureKey="payments"
        title="Parent payments"
        subtitle="Set up parent payments, manage monthly payment plans, and spot failed payments quickly."
        actions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void loadPayments(true)}
            disabled={loading || refreshing}
          >
            {refreshing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            Refresh
          </Button>
        }
      />

      {error ? <FormErrorAlert message={error} /> : null}
      {success ? (
        <div className="football-panel football-panel-interactive rounded-2xl p-5 text-sm text-accent">
          {success}
        </div>
      ) : null}

      <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="bg-accent/12 ring-accent/25 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
            <PoundSterling className="text-accent size-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Set up a monthly payment plan
            </h2>
            <p className="text-muted mt-1 text-sm">
              Choose a player, payment frequency, and amount. Parents complete payment through a
              secure payment link.
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
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 disabled:opacity-70 dark:ring-offset-background"
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
              Payment frequency
            </label>
            <select
              id="interval"
              value={interval}
              onChange={(e) => setInterval(e.target.value as BillingInterval)}
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
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
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
              placeholder="49.00"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              disabled={paymentActionInProgress || !selectedPlayer}
              onClick={() => void createSubscription()}
              className="bg-foreground text-background hover:opacity-90 focus-visible:ring-accent/40 inline-flex h-11 w-full items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            >
              {creatingSubscription ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Creating...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 size-4" aria-hidden />
                  Create monthly payment plan
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

      <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="bg-accent/12 ring-accent/25 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
            <ExternalLink className="text-accent size-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Create parent payment link
            </h2>
            <p className="text-muted mt-1 text-sm">
              Create a secure payment link parents can open to add their payment details and start
              regular monthly payments.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void createCheckoutLink(false)}
            disabled={paymentActionInProgress || !selectedPlayer}
            className="bg-accent text-white hover:opacity-90 focus-visible:ring-accent/40 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
          >
            {creatingCheckoutLink ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Creating...
              </>
            ) : (
              <>
                <ExternalLink className="mr-2 size-4" aria-hidden />
                Create secure payment link
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => void createCheckoutLink(true)}
            disabled={
              paymentActionInProgress ||
              !selectedPlayer?.parent_email
            }
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex h-11 items-center justify-center rounded-full border px-6 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 dark:hover:bg-white/[0.06]"
          >
            {sendingCheckoutLink ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 size-4" aria-hidden />
                Send payment link
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
                className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex h-10 items-center justify-center rounded-full border px-5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
              >
                <Copy className="mr-2 size-4" aria-hidden />
                {copiedCheckoutLink ? "Copied" : "Copy Link"}
              </button>
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-foreground text-background hover:opacity-90 focus-visible:ring-accent/40 inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
          <PanelSkeleton />
        ) : null}

        {!loading && players.length === 0 ? (
          <EmptyState
            {...footballEmptyPreset("players")}
            actionLabel="Add players"
            actionHref="/dashboard/players"
          />
        ) : null}

        {!loading && players.length > 0 && subscriptions.length === 0 ? (
          <EmptyState {...footballEmptyPreset("payments")} />
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
                  className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6"
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
                        paymentActionInProgress ||
                        !player.parent_email ||
                        hasCustomer
                      }
                      className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex h-9 items-center justify-center rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 dark:hover:bg-white/[0.06]"
                    >
                      {creatingCustomerId === player.id ? (
                        <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden />
                      ) : null}
                      {hasCustomer ? "Parent payment setup complete" : "Set up parent payments"}
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
                          role="status"
                          aria-live="polite"
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                            statusTone(latestSubscription.status),
                          )}
                        >
                          <SubscriptionStatusIcon status={latestSubscription.status} />
                          {getSubscriptionStatusPresentation(latestSubscription.status).label}
                        </span>
                        {getSubscriptionStatusPresentation(latestSubscription.status)
                          .needsAttention || isOverdue(latestSubscription) ? (
                          <span
                            role="status"
                            aria-live="polite"
                            className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-800 ring-1 ring-red-500/25 dark:text-red-200"
                          >
                            <AlertTriangle
                              className="mr-1 size-3"
                              aria-hidden
                            />
                            Needs attention
                          </span>
                        ) : null}
                        <span className="border-border text-muted inline-flex rounded-full border px-2.5 py-1 text-xs font-medium">
                          {latestSubscription.subscription_kind === "recurring_series"
                            ? "Weekly training package"
                            : "Custom monthly plan"}
                        </span>
                      </div>
                      {latestSubscription.subscription_kind === "recurring_series" ? (
                        <p className="text-muted mt-3 text-xs">
                          {getSeriesTitle(latestSubscription) ?? "Weekly training package"}
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
                          <dt className="text-muted text-xs">Monthly payment</dt>
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
                      {getSubscriptionStatusPresentation(latestSubscription.status)
                        .needsAttention ? (
                        <div className="text-muted mt-4 space-y-1 text-xs leading-relaxed">
                          <p>
                            {getSubscriptionStatusHelperCopy(latestSubscription.status) ??
                              PAYMENT_STATUS_HELPER_COPY}
                          </p>
                          <p className="text-muted/80 text-[11px]">
                            Payment status: {latestSubscription.status}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-muted mt-5 rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
                      No monthly payment plan yet.
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
