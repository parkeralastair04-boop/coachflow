"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

type DiagnosticsPayload = {
  app: {
    version: string;
    release: string;
    environment: string;
    buildTimestamp: string | null;
    commitSha: string | null;
  };
  health: {
    status: string;
    components: Array<{ name: string; status: string; detail: string }>;
    env: { ok: boolean; missingRequired: string[] };
  };
  webhooks: {
    processed24h: number;
    failed24h: number;
    recentFailures: Array<{ id: string; created_at: string; error: string | null }>;
  };
  activation: { last7d: number; byEvent: Record<string, number> };
  parentJourney: { last7d: number };
  jobs: { note: string; stripeWebhookLedger: string };
  analytics: { funnels: readonly string[] };
};

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "healthy" || status === "ok"
      ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
      : status === "warning"
        ? "bg-amber-500/15 text-amber-900 dark:text-amber-100"
        : "bg-red-500/15 text-red-800 dark:text-red-200";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}

export function OpsDiagnosticsPanel({ initial }: { initial: DiagnosticsPayload }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/internal/diagnostics", { cache: "no-store" });
      const payload = (await response.json()) as DiagnosticsPayload & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to refresh diagnostics.");
      }
      setData(payload);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Refresh failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusPill status={data.health.status} />
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="border-border hover:bg-surface-hover inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium disabled:opacity-60 dark:hover:bg-white/[0.06]"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          Refresh
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <section className="glass-panel grid gap-4 rounded-2xl p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-muted text-xs font-medium uppercase tracking-wide">Version</p>
          <p className="mt-1 font-semibold">{data.app.version}</p>
        </div>
        <div>
          <p className="text-muted text-xs font-medium uppercase tracking-wide">Release</p>
          <p className="mt-1 break-all text-sm font-medium">{data.app.release}</p>
        </div>
        <div>
          <p className="text-muted text-xs font-medium uppercase tracking-wide">Environment</p>
          <p className="mt-1 font-semibold">{data.app.environment}</p>
        </div>
        <div>
          <p className="text-muted text-xs font-medium uppercase tracking-wide">Build</p>
          <p className="mt-1 text-sm font-medium">
            {data.app.buildTimestamp ?? "Not stamped"}
          </p>
        </div>
      </section>

      <section className="glass-panel interactive-surface rounded-2xl p-5">
        <h2 className="text-lg font-semibold tracking-tight">Health components</h2>
        <ul className="mt-4 space-y-3">
          {data.health.components.map((component) => (
            <li
              key={component.name}
              className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-black/[0.02] px-4 py-3 dark:bg-white/[0.03]"
            >
              <div>
                <p className="font-medium capitalize">{component.name.replaceAll("_", " ")}</p>
                <p className="text-muted mt-1 text-sm">{component.detail}</p>
              </div>
              <StatusPill status={component.status} />
            </li>
          ))}
        </ul>
        {!data.health.env.ok ? (
          <p className="mt-4 text-sm text-amber-800 dark:text-amber-200">
            Missing required env: {data.health.env.missingRequired.join(", ")}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="glass-panel interactive-surface rounded-2xl p-5">
          <h2 className="text-lg font-semibold tracking-tight">Stripe webhooks (24h)</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Processed</dt>
              <dd className="mt-1 text-2xl font-semibold">{data.webhooks.processed24h}</dd>
            </div>
            <div>
              <dt className="text-muted">Failed</dt>
              <dd className="mt-1 text-2xl font-semibold">{data.webhooks.failed24h}</dd>
            </div>
          </dl>
          {data.webhooks.recentFailures.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm">
              {data.webhooks.recentFailures.map((failure) => (
                <li key={failure.id} className="rounded-lg bg-black/[0.02] px-3 py-2 dark:bg-white/[0.03]">
                  <p className="font-mono text-xs">{failure.id}</p>
                  <p className="text-muted mt-1">{failure.error ?? "Unknown error"}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted mt-4 text-sm">No recent webhook failures.</p>
          )}
          <p className="text-muted mt-4 text-xs">{data.jobs.note}</p>
        </div>

        <div className="glass-panel interactive-surface rounded-2xl p-5">
          <h2 className="text-lg font-semibold tracking-tight">Activation (7d)</h2>
          <p className="mt-2 text-2xl font-semibold">{data.activation.last7d}</p>
          <p className="text-muted text-sm">Parent journey events: {data.parentJourney.last7d}</p>
          <ul className="mt-4 space-y-1 text-sm">
            {Object.entries(data.activation.byEvent).map(([event, count]) => (
              <li key={event} className="flex justify-between gap-3">
                <span className="text-muted">{event}</span>
                <span className="font-medium">{count}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted mt-4 text-xs">
            Funnels prepared: {data.analytics.funnels.join(", ")}
          </p>
        </div>
      </section>
    </div>
  );
}
