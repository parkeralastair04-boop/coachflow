"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, Palette, Save, Upload } from "lucide-react";
import {
  ACADEMY_SUPPORT_PHONE_ENABLED,
  DEFAULT_ACADEMY_BRANDING,
  type AcademyBranding,
  type AcademyRole,
} from "@/lib/academy-shared";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { FormErrorAlert } from "@/components/form-error-alert";
import { SetupRequiredPanel } from "@/components/setup-required-panel";
import { createClient } from "@/lib/supabase";
import {
  getSetupRequiredMessage,
  isMissingTableError,
  resolveQueryError,
} from "@/lib/supabase-errors";
import { sanitizeDashboardSaveError } from "@/lib/user-facing-errors";
import { saveAcademyBusinessName } from "@/lib/onboarding-setup";
import { isValidEmail } from "@/lib/validation/email";
import { isValidSupportPhone, normaliseSupportPhone } from "@/lib/validation/phone";
import { PanelSkeleton } from "@/components/branded-loading";

type AcademyMember = {
  id: string;
  user_id: string;
  role: AcademyRole;
  created_at: string;
};

type AcademyMemberResponse = AcademyMember & {
  academy: AcademyBranding | AcademyBranding[] | null;
};

function normalizeAcademy(
  academy: AcademyBranding | AcademyBranding[] | null,
): AcademyBranding | null {
  return Array.isArray(academy) ? (academy[0] ?? null) : academy;
}

export function AcademySettingsManager() {
  const [coachId, setCoachId] = useState("");
  const [academy, setAcademy] = useState<AcademyBranding | null>(null);
  const [members, setMembers] = useState<AcademyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [supportEmailError, setSupportEmailError] = useState<string | null>(null);
  const [supportPhoneError, setSupportPhoneError] = useState<string | null>(null);
  const [setupTables, setSetupTables] = useState<string[]>([]);

  const loadAcademy = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSetupTables([]);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        setError(sanitizeDashboardSaveError(userError, { logLabel: "academy-settings-auth" }));
        return;
      }
      if (!user) {
        setError("You must be signed in to manage academy settings.");
        return;
      }

      setCoachId(user.id);
      const { data: membership, error: membershipError } = await supabase
        .from("academy_members")
        .select(
          "id, user_id, role, created_at, academy:academies(id, name, logo_url, primary_color, secondary_color, custom_domain, support_email, public_description, public_address)",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        if (isMissingTableError(membershipError)) {
          setSetupTables(["academies", "academy_members"]);
          return;
        }
        const resolved = resolveQueryError(membershipError, "academy_members");
        if (resolved.setupRequired) {
          setSetupTables([resolved.table]);
          return;
        }
        setError(resolved.message);
        return;
      }

      let activeAcademy = normalizeAcademy(
        (membership as AcademyMemberResponse | null)?.academy ?? null,
      );

      if (!activeAcademy) {
        try {
          const context = await saveAcademyBusinessName(supabase, {
            coachId: user.id,
            email: user.email ?? null,
            businessName: "My Academy",
          });

          if (!context.academyId) {
            setError("Could not create your academy.");
            return;
          }

          const { data: createdAcademy, error: createdError } = await supabase
            .from("academies")
            .select(
              "id, name, logo_url, primary_color, secondary_color, custom_domain, support_email, public_description, public_address",
            )
            .eq("id", context.academyId)
            .single();

          if (createdError || !createdAcademy) {
            if (createdError && isMissingTableError(createdError)) {
              setSetupTables(["academies", "academy_members"]);
              return;
            }
            setError(
              sanitizeDashboardSaveError(createdError ?? new Error("Could not create your academy."), {
                logLabel: "academy-settings-create",
              }),
            );
            return;
          }

          activeAcademy = createdAcademy as AcademyBranding;
        } catch (createCaught: unknown) {
          const tableError =
            typeof createCaught === "object" && createCaught !== null
              ? (createCaught as { message?: string; code?: string })
              : null;
          if (isMissingTableError(tableError)) {
            setSetupTables(["academies", "academy_members"]);
            return;
          }
          setError(sanitizeDashboardSaveError(createCaught, { logLabel: "academy-settings-create" }));
          return;
        }
      }

      setAcademy(activeAcademy);
      const { data: memberRows, error: membersError } = await supabase
        .from("academy_members")
        .select("id, user_id, role, created_at")
        .eq("academy_id", activeAcademy.id)
        .order("created_at", { ascending: true });

      if (membersError) {
        if (isMissingTableError(membersError)) {
          setSetupTables(["academy_members"]);
          return;
        }
        setError(sanitizeDashboardSaveError(membersError, { logLabel: "academy-settings-load" }));
        return;
      }

      setMembers((memberRows ?? []) as AcademyMember[]);
    } catch (caughtError: unknown) {
      setError(sanitizeDashboardSaveError(caughtError, { logLabel: "academy-settings-load" }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      await loadAcademy();
    }
    void init();
  }, [loadAcademy]);

  function updateAcademy(patch: Partial<AcademyBranding>) {
    setAcademy((current) => (current ? { ...current, ...patch } : current));
  }

  async function saveSettings() {
    if (!academy) return;

    const supportEmail = academy.support_email?.trim() ?? "";
    if (supportEmail && !isValidEmail(supportEmail)) {
      setSupportEmailError("Please enter a valid email address.");
      return;
    }

    const supportPhone = academy.support_phone?.trim() ?? "";
    if (ACADEMY_SUPPORT_PHONE_ENABLED && supportPhone && !isValidSupportPhone(supportPhone)) {
      setSupportPhoneError("Please enter a valid phone number.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    setSupportEmailError(null);
    setSupportPhoneError(null);

    try {
      const supabase = createClient();
      const updatePayload: Record<string, string | null> = {
        name: academy.name.trim(),
        logo_url: academy.logo_url?.trim() || null,
        primary_color: academy.primary_color,
        secondary_color: academy.secondary_color,
        custom_domain: academy.custom_domain?.trim() || null,
        support_email: academy.support_email?.trim() || null,
        public_description: academy.public_description?.trim() || null,
        public_address: academy.public_address?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (ACADEMY_SUPPORT_PHONE_ENABLED) {
        updatePayload.support_phone = normaliseSupportPhone(supportPhone);
      }

      const { data, error: saveError } = await supabase
        .from("academies")
        .update(updatePayload)
        .eq("id", academy.id)
        .select("id, name, logo_url, primary_color, secondary_color, custom_domain, support_email, public_description, public_address")
        .single();

      if (saveError) {
        setError(sanitizeDashboardSaveError(saveError, { logLabel: "academy-settings-save" }));
        return;
      }

      setAcademy(data as AcademyBranding);
      setSuccess("Academy branding saved.");
    } catch (caughtError: unknown) {
      setError(sanitizeDashboardSaveError(caughtError, { logLabel: "academy-settings-load" }));
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File | null) {
    if (!file || !academy || !coachId) return;
    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop() ?? "png";
      const path = `${academy.id}/${coachId}-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("academy-logos")
        .upload(path, file, { upsert: true });

      if (uploadError) {
        setError(sanitizeDashboardSaveError(uploadError, { logLabel: "academy-settings-upload" }));
        return;
      }

      const { data } = supabase.storage.from("academy-logos").getPublicUrl(path);
      updateAcademy({ logo_url: data.publicUrl });
      setSuccess("Logo uploaded. Save settings to apply it.");
    } catch (caughtError: unknown) {
      setError(sanitizeDashboardSaveError(caughtError, { logLabel: "academy-settings-load" }));
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <PanelSkeleton />
    );
  }

  if (setupTables.length > 0) {
    return (
      <div className="page-content-enter space-y-10">
        <FeaturePageHeader
          featureKey="academy"
          title="Club Identity"
          subtitle="Crest, colours, domains, support details, and multi-coach access parents see across Awarix."
          subtitleClassName="max-w-2xl"
        />
        <SetupRequiredPanel
          {...getSetupRequiredMessage(setupTables)}
          tables={setupTables}
        />
      </div>
    );
  }

  if (!academy) {
    return (
      <FormErrorAlert message={error ?? "Academy settings could not be loaded."} />
    );
  }

  return (
    <div className="page-content-enter space-y-10">
      <FeaturePageHeader
        featureKey="academy"
        title="Club Identity"
        subtitle="Crest, colours, domains, support details, and multi-coach access parents see across Awarix."
        subtitleClassName="max-w-2xl"
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
            <Palette className="text-accent size-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Club branding
            </h2>
            <p className="text-muted mt-1 text-sm">
              Crest, colours, and name parents see on booking, reports, emails,
              and your academy website.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium">Academy name</label>
            <input
              value={academy.name}
              onChange={(e) => updateAcademy({ name: e.target.value })}
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Primary colour</label>
            <input
              type="color"
              value={academy.primary_color}
              onChange={(e) => updateAcademy({ primary_color: e.target.value })}
              className="border-border bg-background h-11 w-full rounded-xl border px-2 py-1"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Secondary colour</label>
            <input
              type="color"
              value={academy.secondary_color}
              onChange={(e) => updateAcademy({ secondary_color: e.target.value })}
              className="border-border bg-background h-11 w-full rounded-xl border px-2 py-1"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Custom domain</label>
            <input
              value={academy.custom_domain ?? ""}
              onChange={(e) => updateAcademy({ custom_domain: e.target.value })}
              placeholder="academyname.awarix.co.uk"
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="supportEmail">
              Support email
            </label>
            <input
              id="supportEmail"
              type="email"
              value={academy.support_email ?? ""}
              onChange={(e) => {
                updateAcademy({ support_email: e.target.value });
                if (supportEmailError) setSupportEmailError(null);
              }}
              aria-invalid={supportEmailError ? true : undefined}
              aria-describedby={supportEmailError ? "supportEmail-error" : undefined}
              placeholder="support@academy.com"
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
            />
            {supportEmailError ? (
              <FormErrorAlert id="supportEmail-error" message={supportEmailError} />
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor="publicDescription">
              Public website description
            </label>
            <textarea
              id="publicDescription"
              rows={4}
              value={academy.public_description ?? ""}
              onChange={(e) => updateAcademy({ public_description: e.target.value })}
              placeholder="Tell families about your academy, age groups, and coaching approach."
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
            />
            <p className="text-muted mt-2 text-xs leading-relaxed">
              Shown on your public Home and About pages.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor="publicAddress">
              Public address <span className="text-muted font-normal">(optional)</span>
            </label>
            <textarea
              id="publicAddress"
              rows={3}
              value={academy.public_address ?? ""}
              onChange={(e) => updateAcademy({ public_address: e.target.value })}
              placeholder="Training venue or correspondence address"
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
            />
            <p className="text-muted mt-2 text-xs leading-relaxed">
              Only shown on the Contact page when filled in.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="supportPhone">
              Support phone number
            </label>
            {ACADEMY_SUPPORT_PHONE_ENABLED ? (
              <>
                <input
                  id="supportPhone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={academy.support_phone ?? ""}
                  onChange={(e) => {
                    updateAcademy({ support_phone: e.target.value });
                    if (supportPhoneError) setSupportPhoneError(null);
                  }}
                  aria-invalid={supportPhoneError ? true : undefined}
                  aria-describedby={
                    supportPhoneError
                      ? "supportPhone-error supportPhone-helper"
                      : "supportPhone-helper"
                  }
                  placeholder="07700 900123"
                  className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
                />
                <p id="supportPhone-helper" className="text-muted mt-2 text-xs leading-relaxed">
                  Parents can use this number if they need help with bookings or training.
                </p>
                {supportPhoneError ? (
                  <FormErrorAlert id="supportPhone-error" message={supportPhoneError} />
                ) : null}
              </>
            ) : (
              <>
                <input
                  id="supportPhone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value=""
                  disabled
                  aria-describedby="supportPhone-helper"
                  placeholder="07700 900123"
                  className="border-border bg-background text-muted h-11 w-full cursor-not-allowed rounded-xl border px-3 text-sm opacity-60"
                />
                <p id="supportPhone-helper" className="text-muted mt-2 text-xs leading-relaxed">
                  Parents can use this number if they need help with bookings or training.
                </p>
                <p className="text-muted mt-1 text-xs font-medium">Available soon</p>
              </>
            )}
          </div>

          <p className="text-muted sm:col-span-2 text-xs leading-relaxed">
            Parents will see these contact details on your booking page and in confirmation emails.
          </p>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium">Logo upload</label>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {academy.logo_url ? (
                <Image
                  src={academy.logo_url}
                  alt={`${academy.name} logo`}
                  width={512}
                  height={342}
                  unoptimized={academy.logo_url.startsWith("http")}
                  className="h-16 w-auto shrink-0 object-contain"
                />
              ) : (
                <div className="text-muted text-sm">No academy logo uploaded.</div>
              )}
              <label className="border-border hover:bg-surface-hover inline-flex h-10 w-fit cursor-pointer items-center justify-center rounded-full border px-5 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]">
                {uploading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                ) : (
                  <Upload className="mr-2 size-4" aria-hidden />
                )}
                Upload logo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => void uploadLogo(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={saving}
          className="bg-foreground text-background hover:opacity-90 mt-8 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 size-4" aria-hidden />
              Save settings
            </>
          )}
        </button>
      </section>

      <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Academy members</h2>
        <p className="text-muted mt-1 text-sm">
          Multi-coach support is backed by roles: owner, admin, coach, assistant.
        </p>
        <div className="mt-5 grid gap-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]"
            >
              <span className="text-muted break-all">{member.user_id}</span>
              <span className="bg-accent/10 text-accent ring-accent/25 rounded-full px-3 py-1 text-xs font-medium capitalize ring-1">
                {member.role}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
