"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { footballEmptyPreset } from "@/lib/football-identity";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { FormErrorAlert } from "@/components/form-error-alert";
import { SetupRequiredPanel } from "@/components/setup-required-panel";
import { createClient } from "@/lib/supabase";
import {
  getSetupRequiredMessage,
  isMissingTableError,
} from "@/lib/supabase-errors";
import { sanitizeDashboardSaveError } from "@/lib/user-facing-errors";

type EnquiryRow = {
  id: string;
  academy_id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  created_at: string;
};

const READ_STORAGE_KEY = "awarix:enquiry-read-ids:v1";

function formatCreatedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function loadReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(READ_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...ids]));
}

export function EnquiriesManager() {
  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([]);
  const [academyId, setAcademyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setupTables, setSetupTables] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [canDelete, setCanDelete] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setReadIds(loadReadIds());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const selected = useMemo(
    () => enquiries.find((row) => row.id === selectedId) ?? null,
    [enquiries, selectedId],
  );

  const loadEnquiries = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSetupTables([]);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("You need to be signed in to view enquiries.");
        setEnquiries([]);
        return;
      }

      const { data: memberships, error: membershipError } = await supabase
        .from("academy_members")
        .select("academy_id, role")
        .eq("user_id", user.id);

      if (membershipError) {
        if (isMissingTableError(membershipError)) {
          setSetupTables(["academy_members"]);
          setEnquiries([]);
          return;
        }
        throw membershipError;
      }

      const membershipList = memberships ?? [];
      if (membershipList.length === 0) {
        setAcademyId(null);
        setCanDelete(false);
        setEnquiries([]);
        setError("Link an academy in Academy Settings to receive website enquiries.");
        return;
      }

      const primaryAcademyId = membershipList[0]?.academy_id as string;
      setAcademyId(primaryAcademyId);
      setCanDelete(
        membershipList.some(
          (row) =>
            row.academy_id === primaryAcademyId &&
            (row.role === "owner" || row.role === "admin"),
        ),
      );

      const { data, error: enquiryError } = await supabase
        .from("academy_enquiries")
        .select("id, academy_id, name, email, phone, subject, message, created_at")
        .eq("academy_id", primaryAcademyId)
        .order("created_at", { ascending: false });

      if (enquiryError) {
        if (isMissingTableError(enquiryError)) {
          setSetupTables(["academy_enquiries"]);
          setEnquiries([]);
          return;
        }
        throw enquiryError;
      }

      const rows = (data ?? []) as EnquiryRow[];
      setEnquiries(rows);
      setSelectedId((current) => current ?? rows[0]?.id ?? null);
    } catch (caughtError: unknown) {
      const maybeError =
        typeof caughtError === "object" && caughtError !== null
          ? (caughtError as { code?: string; message?: string })
          : null;
      if (isMissingTableError(maybeError)) {
        setSetupTables(["academy_enquiries"]);
        setEnquiries([]);
      } else {
        setError(sanitizeDashboardSaveError(caughtError, { logLabel: "enquiries-load" }));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadEnquiries();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadEnquiries]);

  function markAsRead(id: string) {
    setReadIds((current) => {
      const next = new Set(current);
      next.add(id);
      saveReadIds(next);
      return next;
    });
    setStatusMessage("Marked as read.");
  }

  async function handleDelete(enquiry: EnquiryRow) {
    if (!canDelete) {
      setError("Only academy owners or admins can delete enquiries.");
      return;
    }
    if (!window.confirm(`Delete enquiry from ${enquiry.name}?`)) return;
    setDeletingId(enquiry.id);
    setError(null);
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("academy_enquiries")
        .delete()
        .eq("id", enquiry.id);
      if (deleteError) throw deleteError;
      setStatusMessage("Enquiry deleted.");
      if (selectedId === enquiry.id) setSelectedId(null);
      await loadEnquiries();
    } catch (caughtError: unknown) {
      setError(sanitizeDashboardSaveError(caughtError, { logLabel: "enquiries-delete" }));
    } finally {
      setDeletingId(null);
    }
  }

  if (setupTables.length > 0) {
    return (
      <div className="space-y-6">
        <FeaturePageHeader
          featureKey="enquiries"
          title="Family Enquiries"
          subtitle="Messages from families via your academy contact form."
        />
        <SetupRequiredPanel
          tables={setupTables}
          {...getSetupRequiredMessage(setupTables)}
          onRetry={() => void loadEnquiries()}
        />
      </div>
    );
  }

  return (
    <div className="page-content-enter space-y-8">
      <FeaturePageHeader
        featureKey="enquiries"
        title="Family Enquiries"
        subtitle="New interest and questions from families via your academy contact page."
      />

      {error ? <FormErrorAlert message={error} /> : null}
      {statusMessage ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
          {statusMessage}
        </p>
      ) : null}

      {!academyId && !loading ? (
        <p className="text-muted rounded-2xl bg-black/[0.03] px-4 py-3 text-sm dark:bg-white/[0.04]">
          Link an academy in Academy Settings to receive website enquiries.
        </p>
      ) : null}

      {loading ? (
        <p className="text-muted text-sm">Loading enquiries…</p>
      ) : enquiries.length === 0 ? (
        <EmptyState {...footballEmptyPreset("enquiries")} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <ul className="space-y-3" role="list" aria-label="Enquiries">
            {enquiries.map((enquiry) => {
              const isRead = readIds.has(enquiry.id);
              const preview =
                enquiry.message.length > 120
                  ? `${enquiry.message.slice(0, 117).trim()}…`
                  : enquiry.message;
              return (
                <li key={enquiry.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(enquiry.id);
                      setStatusMessage(null);
                    }}
                    className={`hover:bg-surface-hover focus-visible:ring-accent/40 w-full rounded-2xl border px-4 py-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:hover:bg-white/[0.06] ${
                      selectedId === enquiry.id
                        ? "border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold tracking-tight">
                          {!isRead ? (
                            <span className="bg-accent mr-2 inline-block size-2 rounded-full align-middle" aria-hidden />
                          ) : null}
                          {enquiry.name}
                          <span className="sr-only">{isRead ? " (read)" : " (unread)"}</span>
                        </p>
                        <p className="text-muted mt-1 truncate text-sm">{enquiry.email}</p>
                        <p className="mt-2 text-sm font-medium">{enquiry.subject}</p>
                        <p className="text-muted mt-1 text-xs">{formatCreatedAt(enquiry.created_at)}</p>
                        <p className="text-muted mt-2 line-clamp-2 text-sm">{preview}</p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <section
            className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6"
            aria-labelledby="enquiry-detail-heading"
          >
            {selected ? (
              <>
                <h2 id="enquiry-detail-heading" className="text-lg font-semibold tracking-tight">
                  {selected.subject}
                </h2>
                <dl className="text-muted mt-4 space-y-2 text-sm">
                  <div>
                    <dt className="sr-only">Name</dt>
                    <dd>
                      <span className="text-foreground font-medium">{selected.name}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="sr-only">Email</dt>
                    <dd>
                      <a
                        href={`mailto:${selected.email}`}
                        className="hover:text-accent focus-visible:ring-accent/40 rounded-sm underline-offset-4 hover:underline outline-none focus-visible:ring-2"
                      >
                        {selected.email}
                      </a>
                    </dd>
                  </div>
                  {selected.phone ? (
                    <div>
                      <dt className="sr-only">Phone</dt>
                      <dd>
                        <a
                          href={`tel:${selected.phone}`}
                          className="hover:text-accent focus-visible:ring-accent/40 rounded-sm underline-offset-4 hover:underline outline-none focus-visible:ring-2"
                        >
                          {selected.phone}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="sr-only">Received</dt>
                    <dd>{formatCreatedAt(selected.created_at)}</dd>
                  </div>
                </dl>
                <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed">{selected.message}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => markAsRead(selected.id)}
                    className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                  >
                    Mark as read
                  </button>
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => void handleDelete(selected)}
                      disabled={deletingId === selected.id}
                      className="border-border text-rose-700 hover:bg-rose-500/10 focus-visible:ring-accent/40 inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 dark:text-rose-300"
                    >
                      {deletingId === selected.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="size-4" aria-hidden />
                      )}
                      Delete
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-muted text-sm">Select an enquiry to read the full message.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
