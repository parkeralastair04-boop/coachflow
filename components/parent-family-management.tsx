"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  Download,
  FileText,
  Loader2,
  Tent,
  UserRound,
} from "lucide-react";
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_TYPES,
  FAMILY_DRAFT_STORAGE_PREFIX,
  SESSION_RESPONSE_LABELS,
  SESSION_RESPONSE_STATUSES,
  type AvailabilityType,
  type ChildProfileData,
  type FamilyProfileData,
  type NotificationPreferences,
} from "@/lib/family-self-service";
import {
  buildFamilyDocumentPdfContent,
  FAMILY_DOCUMENTS,
  type FamilyDocumentId,
} from "@/lib/family-documents";
import { formatMoney, formatPortalDate } from "@/lib/parent-portal-format";
import type {
  ParentCampItem,
  ParentPaymentItem,
  ParentSubscriptionItem,
  ParentUpcomingSession,
} from "@/lib/parent-portal-types";
import type { SessionResponseEntry } from "@/lib/family-self-service";
import { sanitizeUserFacingError } from "@/lib/user-facing-errors";

type ChildSelfService = {
  playerId: string;
  playerName: string;
  child: ChildProfileData;
  childPending: Partial<ChildProfileData> | null;
  availability: Array<{
    id: string;
    type: AvailabilityType;
    note: string | null;
    startDate: string | null;
    endDate: string | null;
    updatedAt: string;
  }>;
  sessionResponses: Record<string, SessionResponseEntry>;
  documents: Record<string, { completedAt: string | null; acknowledged: boolean } | undefined>;
  notifications: NotificationPreferences;
  paymentPauseRequest: { status: string; reason: string | null } | null;
};

type SelfServicePayload = {
  welcomeName: string;
  approvalRequired: boolean;
  family: FamilyProfileData;
  familyPending: Partial<FamilyProfileData> | null;
  children: ChildSelfService[];
  upcomingSessions: ParentUpcomingSession[];
  camps: ParentCampItem[];
  subscriptions: ParentSubscriptionItem[];
  recentPayments: ParentPaymentItem[];
};

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ParentFamilyManagement() {
  const [data, setData] = useState<SelfServicePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [invoices, setInvoices] = useState<
    Array<{ number: string | null; amount: number; currency: string; createdAt: string; pdfUrl: string | null }>
  >([]);
  const [upcomingPayment, setUpcomingPayment] = useState<{
    date: string;
    amount: number;
    currency: string;
    interval: string | null;
  } | null>(null);

  const [familyForm, setFamilyForm] = useState<FamilyProfileData | null>(null);
  const [childForm, setChildForm] = useState<ChildProfileData | null>(null);
  const [availabilityType, setAvailabilityType] = useState<AvailabilityType>("unavailable");
  const [availabilityNote, setAvailabilityNote] = useState("");
  const [notifications, setNotifications] = useState<NotificationPreferences | null>(null);

  const selectedChild = useMemo(
    () => data?.children.find((child) => child.playerId === selectedChildId) ?? data?.children[0] ?? null,
    [data?.children, selectedChildId],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [selfServiceRes, invoicesRes] = await Promise.all([
        fetch("/api/family/self-service", { cache: "no-store" }),
        fetch("/api/family/invoices", { cache: "no-store" }),
      ]);
      const payload = (await selfServiceRes.json()) as SelfServicePayload & { error?: string };
      if (!selfServiceRes.ok) throw new Error(payload.error ?? "Unable to load family management.");

      setData(payload);
      setFamilyForm({ ...payload.family, ...(payload.familyPending ?? {}) });
      const firstChild = payload.children[0];
      if (firstChild) {
        setSelectedChildId(firstChild.playerId);
        setChildForm({ ...firstChild.child, ...(firstChild.childPending ?? {}) });
        setNotifications(firstChild.notifications);
      }

      if (invoicesRes.ok) {
        const invoicePayload = (await invoicesRes.json()) as {
          invoices?: typeof invoices;
          upcomingPayment?: typeof upcomingPayment;
        };
        setInvoices(invoicePayload.invoices ?? []);
        setUpcomingPayment(invoicePayload.upcomingPayment ?? null);
      }
    } catch (caughtError: unknown) {
      setError(
        sanitizeUserFacingError(caughtError, {
          context: "general",
          logLabel: "parent-family-management",
        }),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadData();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadData]);

  useEffect(() => {
    if (!selectedChild || !childForm) return;
    const draftKey = `${FAMILY_DRAFT_STORAGE_PREFIX}${selectedChild.playerId}`;
    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(draftKey, JSON.stringify(childForm));
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [childForm, selectedChild]);

  const selectChild = useCallback(
    (playerId: string) => {
      setSelectedChildId(playerId);
      const child = data?.children.find((entry) => entry.playerId === playerId);
      if (!child) return;

      let nextForm: ChildProfileData = {
        ...child.child,
        ...(child.childPending ?? {}),
      };
      const draftRaw = window.localStorage.getItem(
        `${FAMILY_DRAFT_STORAGE_PREFIX}${playerId}`,
      );
      if (draftRaw) {
        try {
          nextForm = { ...nextForm, ...(JSON.parse(draftRaw) as Partial<ChildProfileData>) };
        } catch {
          // Ignore invalid draft payloads.
        }
      }

      setChildForm(nextForm);
      setNotifications(child.notifications);
    },
    [data?.children],
  );

  async function patchSelfService(body: Record<string, unknown>) {
    setSaving(true);
    setStatusMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/family/self-service", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save.");
      setStatusMessage(result.message ?? "Family details saved.");
      await loadData();
    } catch (caughtError: unknown) {
      setError(
        sanitizeUserFacingError(caughtError, {
          context: "general",
          logLabel: "parent-family-save",
        }),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCampAction(campId: string, action: "join_waitlist" | "leave_waitlist" | "cancel_booking") {
    if (!selectedChild) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/family/camp-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campId, playerId: selectedChild.playerId, action }),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to update camp booking.");
      setStatusMessage(result.message ?? "Camp booking updated.");
      await loadData();
    } catch (caughtError: unknown) {
      setError(
        sanitizeUserFacingError(caughtError, {
          context: "general",
          logLabel: "parent-camp-action",
        }),
      );
    } finally {
      setSaving(false);
    }
  }

  function handleDownloadDocument(documentId: FamilyDocumentId) {
    if (!selectedChild) return;
    const content = buildFamilyDocumentPdfContent({
      documentId,
      academyName: "Your academy",
      playerName: selectedChild.playerName,
      parentName: data?.family.preferredEmail ?? null,
    });
    downloadTextFile(`${documentId}-${selectedChild.playerName}.txt`, content);
    void patchSelfService({
      section: "document",
      playerId: selectedChild.playerId,
      documentId,
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/family"
            className="text-muted focus-visible:ring-accent/40 inline-flex min-h-11 items-center gap-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to family dashboard
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Family details</h1>
          <p className="text-muted mt-2 text-sm" role="status">
            {loading
              ? "Loading family settings..."
              : data?.approvalRequired
                ? "Profile changes may need coach approval before they go live."
                : "Update family details without messaging your coach."}
          </p>
        </div>
      </div>

      {error ? (
        <div className="football-panel football-panel-interactive rounded-2xl p-6 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </div>
      ) : null}
      {statusMessage ? (
        <p className="text-sm" role="status">
          {statusMessage}
        </p>
      ) : null}

      {loading ? (
        <div className="football-panel flex items-center gap-3 rounded-2xl p-6 text-sm" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading...
        </div>
      ) : null}

      {!loading && data && familyForm && childForm && selectedChild && notifications ? (
        <>
          <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="family-profile-heading">
            <h2 id="family-profile-heading" className="text-lg font-semibold tracking-tight">
              Family details
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="familyPhone">
                  Phone number
                </label>
                <input
                  id="familyPhone"
                  value={familyForm.phone ?? ""}
                  onChange={(event) =>
                    setFamilyForm((current) => ({ ...current!, phone: event.target.value }))
                  }
                  className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="familyEmail">
                  Preferred email
                </label>
                <input
                  id="familyEmail"
                  type="email"
                  value={familyForm.preferredEmail ?? ""}
                  onChange={(event) =>
                    setFamilyForm((current) => ({
                      ...current!,
                      preferredEmail: event.target.value,
                    }))
                  }
                  className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium" htmlFor="emergencyContact">
                  Emergency contact
                </label>
                <input
                  id="emergencyContact"
                  value={familyForm.emergencyContact ?? ""}
                  onChange={(event) =>
                    setFamilyForm((current) => ({
                      ...current!,
                      emergencyContact: event.target.value,
                    }))
                  }
                  className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                />
              </div>
              <fieldset className="md:col-span-2">
                <legend className="mb-2 text-sm font-medium">Communication preferences</legend>
                <ul className="space-y-2" role="list">
                  {(
                    [
                      ["sessionReminders", "Session reminders"],
                      ["campUpdates", "Camp updates"],
                      ["weeklyReminders", "Weekly reminders"],
                      ["reports", "Reports"],
                      ["marketing", "Marketing"],
                    ] as const
                  ).map(([key, label]) => (
                    <li key={key} role="listitem">
                      <label className="flex min-h-11 items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={familyForm.communicationPreferences[key]}
                          onChange={(event) =>
                            setFamilyForm((current) => ({
                              ...current!,
                              communicationPreferences: {
                                ...current!.communicationPreferences,
                                [key]: event.target.checked,
                              },
                            }))
                          }
                        />
                        {label}
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void patchSelfService({ section: "family", family: familyForm })}
              className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            >
              Save family profile
            </button>
          </section>

          <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="child-profile-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="child-profile-heading" className="text-lg font-semibold tracking-tight">
                Child profile
              </h2>
              <select
                aria-label="Select child"
                value={selectedChildId}
                onChange={(event) => selectChild(event.target.value)}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              >
                {data.children.map((child) => (
                  <option key={child.playerId} value={child.playerId}>
                    {child.playerName}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 flex items-start gap-4">
              <div
                className="bg-accent/10 text-accent ring-accent/20 flex size-16 shrink-0 items-center justify-center rounded-2xl ring-1"
                aria-hidden
              >
                <UserRound className="size-8" />
              </div>
              <div className="grid flex-1 gap-4 md:grid-cols-2">
                {(
                  [
                    ["preferredName", "Preferred name"],
                    ["pronouns", "Pronouns (optional)"],
                    ["schoolYear", "School year"],
                    ["shirtSize", "Shirt size"],
                    ["bootSize", "Boot size"],
                    ["photoUrl", "Photo URL"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="mb-2 block text-sm font-medium" htmlFor={`child-${key}`}>
                      {label}
                    </label>
                    <input
                      id={`child-${key}`}
                      value={childForm[key] ?? ""}
                      onChange={(event) =>
                        setChildForm((current) => ({
                          ...current!,
                          [key]: event.target.value,
                        }))
                      }
                      className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                    />
                  </div>
                ))}
                {(
                  [
                    ["medicalInformation", "Medical information"],
                    ["allergies", "Allergies"],
                    ["medication", "Medication"],
                    ["emergencyNotes", "Emergency notes"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium" htmlFor={`child-${key}`}>
                      {label}
                    </label>
                    <textarea
                      id={`child-${key}`}
                      value={childForm[key] ?? ""}
                      onChange={(event) =>
                        setChildForm((current) => ({
                          ...current!,
                          [key]: event.target.value,
                        }))
                      }
                      className="border-border bg-background focus-visible:ring-accent/40 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2"
                    />
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void patchSelfService({
                  section: "child",
                  playerId: selectedChild.playerId,
                  child: childForm,
                })
              }
              className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            >
              Save child profile
            </button>
          </section>

          <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="availability-heading">
            <h2 id="availability-heading" className="text-lg font-semibold tracking-tight">
              Attendance availability
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="availabilityType">
                  Mark as
                </label>
                <select
                  id="availabilityType"
                  value={availabilityType}
                  onChange={(event) =>
                    setAvailabilityType(event.target.value as AvailabilityType)
                  }
                  className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                >
                  {AVAILABILITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {AVAILABILITY_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="availabilityNote">
                  Note
                </label>
                <input
                  id="availabilityNote"
                  value={availabilityNote}
                  onChange={(event) => setAvailabilityNote(event.target.value)}
                  className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void patchSelfService({
                  section: "availability",
                  playerId: selectedChild.playerId,
                  availability: { type: availabilityType, note: availabilityNote },
                })
              }
              className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            >
              Save availability
            </button>
            {selectedChild.availability.length > 0 ? (
              <ul className="mt-4 space-y-2" role="list" aria-label="Saved availability">
                {selectedChild.availability.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-xl bg-black/[0.02] px-3 py-2 text-sm dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    {AVAILABILITY_LABELS[entry.type]}
                    {entry.note ? ` — ${entry.note}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="session-responses-heading">
            <h2 id="session-responses-heading" className="text-lg font-semibold tracking-tight">
              Upcoming session responses
            </h2>
            {data.upcomingSessions.length === 0 ? (
              <p className="text-muted mt-4 text-sm" role="status">
                No upcoming sessions to respond to.
              </p>
            ) : (
              <ul className="mt-4 space-y-3" role="list">
                {data.upcomingSessions
                  .filter((session) => session.playerId === selectedChild.playerId)
                  .map((session) => (
                    <li
                      key={session.id}
                      className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
                      role="listitem"
                    >
                      <p className="font-medium">{session.sessionTitle}</p>
                      <p className="text-muted mt-1 text-sm">{formatPortalDate(session.sessionDate)}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {SESSION_RESPONSE_STATUSES.map((status) => (
                          <button
                            key={status}
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              void patchSelfService({
                                section: "session_response",
                                playerId: selectedChild.playerId,
                                sessionId: session.sessionId,
                                sessionResponse: { status },
                              })
                            }
                            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                          >
                            {SESSION_RESPONSE_LABELS[status]}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="camps-heading">
            <h2 id="camps-heading" className="text-lg font-semibold tracking-tight">
              Camp management
            </h2>
            {data.camps.length === 0 ? (
              <p className="text-muted mt-4 text-sm" role="status">
                No upcoming camps.
              </p>
            ) : (
              <ul className="mt-4 space-y-3" role="list">
                {data.camps
                  .filter(
                    (camp) =>
                      !camp.playerId || camp.playerId === selectedChild.playerId,
                  )
                  .map((camp) => (
                  <li
                    key={camp.id}
                    className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    <div className="flex items-start gap-3">
                      <Tent className="text-accent mt-0.5 size-5 shrink-0" aria-hidden />
                      <div className="flex-1">
                        <p className="font-medium">{camp.name}</p>
                        <p className="text-muted mt-1 text-sm">{camp.statusLabel}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {camp.status === "available" ? (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void handleCampAction(camp.id, "join_waitlist")}
                              className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                              Join waiting list
                            </button>
                          ) : null}
                          {camp.status === "waitlist" ? (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void handleCampAction(camp.id, "leave_waitlist")}
                              className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                              Leave waiting list
                            </button>
                          ) : null}
                          {camp.status === "booked" ? (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void handleCampAction(camp.id, "cancel_booking")}
                              className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                              Cancel booking
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              downloadTextFile(
                                `${camp.name}-information-pack.txt`,
                                `${camp.name}\n${formatPortalDate(camp.startDate)} – ${formatPortalDate(camp.endDate)}\n${camp.location ?? "Location to be confirmed"}\n\nPlease bring appropriate kit, water, and any medical information your coach should know.`,
                              )
                            }
                            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            <Download className="size-4" aria-hidden />
                            Download information pack
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="payments-heading">
            <h2 id="payments-heading" className="text-lg font-semibold tracking-tight">
              Payments
            </h2>
            {upcomingPayment ? (
              <p className="text-muted mt-2 text-sm" role="status">
                Upcoming payment: {formatMoney(upcomingPayment.amount, upcomingPayment.currency)} on{" "}
                {formatPortalDate(upcomingPayment.date)}
              </p>
            ) : (
              <p className="text-muted mt-2 text-sm">No upcoming subscription payment on file.</p>
            )}
            {invoices.length > 0 ? (
              <ul className="mt-4 space-y-2" role="list" aria-label="Payment history">
                {invoices.map((invoice) => (
                  <li
                    key={invoice.number ?? invoice.createdAt}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/[0.02] px-3 py-2 text-sm dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    <span>
                      {formatMoney(invoice.amount, invoice.currency)} ·{" "}
                      {formatPortalDate(invoice.createdAt)}
                    </span>
                    {invoice.pdfUrl ? (
                      <a
                        href={invoice.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent focus-visible:ring-accent/40 inline-flex min-h-11 items-center underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        View invoice
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  const response = await fetch("/api/family/billing-portal", { method: "POST" });
                  const payload = (await response.json()) as { url?: string; error?: string };
                  if (payload.url) window.location.href = payload.url;
                  else setError(payload.error ?? "Unable to open payment details.");
                }}
                className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
              >
                <CreditCard className="size-4" aria-hidden />
                Update payment details
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void patchSelfService({
                    section: "payment_pause",
                    playerId: selectedChild.playerId,
                    paymentPauseReason: "Family requested a temporary pause.",
                  })
                }
                className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Request payment pause
              </button>
            </div>
          </section>

          <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="documents-heading">
            <h2 id="documents-heading" className="text-lg font-semibold tracking-tight">
              Documents
            </h2>
            <ul className="mt-4 space-y-3" role="list">
              {FAMILY_DOCUMENTS.map((document) => {
                const completion = selectedChild.documents[document.id];
                return (
                  <li
                    key={document.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/[0.02] px-3 py-3 text-sm dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    <div>
                      <p className="font-medium">{document.title}</p>
                      <p className="text-muted mt-1">{document.description}</p>
                      <p className="text-muted mt-1">
                        {completion?.acknowledged ? "Completed" : "Not completed"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadDocument(document.id)}
                      className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <FileText className="size-4" aria-hidden />
                      Download
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="notifications-heading">
            <h2 id="notifications-heading" className="text-lg font-semibold tracking-tight">
              Notifications
            </h2>
            <ul className="mt-4 space-y-3" role="list">
              {(
                [
                  ["emailReminders", "Email reminders"],
                  ["campUpdates", "Camp updates"],
                  ["weeklyReminders", "Weekly reminders"],
                  ["reports", "Reports"],
                  ["marketing", "Marketing"],
                ] as const
              ).map(([key, label]) => (
                <li key={key} role="listitem">
                  <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={notifications[key]}
                      onChange={(event) => {
                        const next = { ...notifications, [key]: event.target.checked };
                        setNotifications(next);
                        void patchSelfService({
                          section: "notifications",
                          playerId: selectedChild.playerId,
                          notifications: next,
                        });
                      }}
                    />
                    {label}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
