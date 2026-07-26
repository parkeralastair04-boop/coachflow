"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, X } from "lucide-react";
import { sanitizeUserFacingError } from "@/lib/user-facing-errors";

type CoachFamilyHubData = {
  pendingProfiles: Array<{
    playerId: string;
    playerName: string;
    parentName: string | null;
    type: "family" | "child";
    changes: Record<string, unknown>;
  }>;
  upcomingAbsences: Array<{
    playerId: string;
    playerName: string;
    type: string;
    note: string | null;
    updatedAt: string;
  }>;
  sessionResponses: Array<{
    playerId: string;
    playerName: string;
    sessionId: string;
    status: string;
    reason: string | null;
    updatedAt: string;
  }>;
  paymentPauseRequests: Array<{
    playerId: string;
    playerName: string;
    reason: string | null;
    requestedAt: string;
  }>;
  documentStatus: Array<{
    playerId: string;
    playerName: string;
    completedCount: number;
    totalCount: number;
  }>;
  awaitingApprovals: number;
};

function formatWhen(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
    parsed,
  );
}

export function CoachFamilyHubPanel() {
  const [data, setData] = useState<CoachFamilyHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadHub = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/coach/family-hub", { cache: "no-store" });
      const payload = (await response.json()) as CoachFamilyHubData & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to load family hub.");
      setData(payload);
    } catch (caughtError: unknown) {
      setError(
        sanitizeUserFacingError(caughtError, {
          context: "general",
          logLabel: "coach-family-hub",
        }),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadHub();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadHub]);

  async function handleApproval(
    playerId: string,
    body: Record<string, boolean>,
  ) {
    setActingId(playerId);
    setError(null);
    try {
      const response = await fetch("/api/coach/family-hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, ...body }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to process approval.");
      await loadHub();
    } catch (caughtError: unknown) {
      setError(
        sanitizeUserFacingError(caughtError, {
          context: "general",
          logLabel: "coach-family-approval",
        }),
      );
    } finally {
      setActingId(null);
    }
  }

  return (
    <section className="glass-panel interactive-surface rounded-2xl p-6 sm:p-8" aria-labelledby="coach-family-hub-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="coach-family-hub-heading" className="text-lg font-semibold tracking-tight">
            Family self-service
          </h2>
          <p className="text-muted mt-1 text-sm">
            Pending profile changes, absences, and parent responses.
          </p>
        </div>
        {data ? (
          <span className="text-muted text-sm" role="status">
            {data.awaitingApprovals} awaiting approval
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-muted mt-4 flex items-center gap-2 text-sm" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading family updates...
        </p>
      ) : null}

      {!loading && data ? (
        <div className="mt-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold">Pending profile changes</h3>
            {data.pendingProfiles.length === 0 ? (
              <p className="text-muted mt-2 text-sm" role="status">
                No pending profile changes.
              </p>
            ) : (
              <ul className="mt-3 space-y-3" role="list">
                {data.pendingProfiles.map((item) => (
                  <li
                    key={`${item.playerId}-${item.type}`}
                    className="rounded-xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    <p className="font-medium">
                      {item.playerName} · {item.type === "family" ? "Family profile" : "Child profile"}
                    </p>
                    <pre className="text-muted mt-2 overflow-x-auto whitespace-pre-wrap text-xs">
                      {JSON.stringify(item.changes, null, 2)}
                    </pre>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={actingId === item.playerId}
                        onClick={() =>
                          void handleApproval(item.playerId, {
                            approveFamily: item.type === "family",
                            approveChild: item.type === "child",
                          })
                        }
                        className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
                      >
                        <Check className="size-4" aria-hidden />
                        Approve
                      </button>
                      <Link
                        href={`/dashboard/players?player=${item.playerId}`}
                        className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        View player
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold">Upcoming absences</h3>
            {data.upcomingAbsences.length === 0 ? (
              <p className="text-muted mt-2 text-sm" role="status">
                No parent-marked absences.
              </p>
            ) : (
              <ul className="mt-3 space-y-2" role="list">
                {data.upcomingAbsences.map((item) => (
                  <li
                    key={`${item.playerId}-${item.updatedAt}`}
                    className="rounded-xl bg-black/[0.02] px-3 py-2 text-sm dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    <span className="font-medium">{item.playerName}</span>
                    <span className="text-muted">
                      {" "}
                      — {item.type}
                      {item.note ? ` · ${item.note}` : ""} · {formatWhen(item.updatedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold">Session responses</h3>
            {data.sessionResponses.length === 0 ? (
              <p className="text-muted mt-2 text-sm" role="status">
                No parent session responses yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2" role="list">
                {data.sessionResponses.map((item) => (
                  <li
                    key={`${item.playerId}-${item.sessionId}`}
                    className="rounded-xl bg-black/[0.02] px-3 py-2 text-sm dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    <span className="font-medium">{item.playerName}</span>
                    <span className="text-muted">
                      {" "}
                      — {item.status}
                      {item.reason ? ` · ${item.reason}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold">Payment pause requests</h3>
            {data.paymentPauseRequests.length === 0 ? (
              <p className="text-muted mt-2 text-sm" role="status">
                No payment pause requests.
              </p>
            ) : (
              <ul className="mt-3 space-y-3" role="list">
                {data.paymentPauseRequests.map((item) => (
                  <li
                    key={item.playerId}
                    className="rounded-xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    <p className="font-medium">{item.playerName}</p>
                    <p className="text-muted mt-1">{item.reason ?? "No reason provided"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={actingId === item.playerId}
                        onClick={() =>
                          void handleApproval(item.playerId, { approvePaymentPause: true })
                        }
                        className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
                      >
                        <Check className="size-4" aria-hidden />
                        Approve pause
                      </button>
                      <button
                        type="button"
                        disabled={actingId === item.playerId}
                        onClick={() =>
                          void handleApproval(item.playerId, { rejectPaymentPause: true })
                        }
                        className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <X className="size-4" aria-hidden />
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold">Document completion</h3>
            <ul className="mt-3 space-y-2" role="list">
              {data.documentStatus.map((item) => (
                <li
                  key={item.playerId}
                  className="rounded-xl bg-black/[0.02] px-3 py-2 text-sm dark:bg-white/[0.03]"
                  role="listitem"
                >
                  {item.playerName}: {item.completedCount}/{item.totalCount} completed
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
