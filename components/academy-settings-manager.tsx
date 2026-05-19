"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, Palette, Save, Upload } from "lucide-react";
import {
  DEFAULT_ACADEMY_BRANDING,
  type AcademyBranding,
  type AcademyRole,
} from "@/lib/academy-shared";
import { SetupRequiredPanel } from "@/components/setup-required-panel";
import { createClient } from "@/lib/supabase";
import {
  getSetupRequiredMessage,
  isMissingTableError,
  resolveQueryError,
} from "@/lib/supabase-errors";

type AcademyMember = {
  id: string;
  user_id: string;
  role: AcademyRole;
  created_at: string;
};

type AcademyMemberResponse = AcademyMember & {
  academy: AcademyBranding | AcademyBranding[] | null;
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
        setError(userError.message);
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
          "id, user_id, role, created_at, academy:academies(id, name, logo_url, primary_color, secondary_color, custom_domain, support_email)",
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
        setError(resolved.message);
        return;
      }

      let activeAcademy = normalizeAcademy(
        (membership as AcademyMemberResponse | null)?.academy ?? null,
      );

      if (!activeAcademy) {
        const { data: createdAcademy, error: createError } = await supabase
          .from("academies")
          .insert({
            ...DEFAULT_ACADEMY_BRANDING,
            name: "My Academy",
            support_email: user.email ?? null,
          })
          .select("id, name, logo_url, primary_color, secondary_color, custom_domain, support_email")
          .single();

        if (createError) {
          if (isMissingTableError(createError)) {
            setSetupTables(["academies", "academy_members"]);
            return;
          }
          setError(createError.message);
          return;
        }

        activeAcademy = createdAcademy as AcademyBranding;
        const { error: memberError } = await supabase
          .from("academy_members")
          .insert({
            academy_id: activeAcademy.id,
            user_id: user.id,
            role: "owner",
          });

        if (memberError) {
          if (isMissingTableError(memberError)) {
            setSetupTables(["academies", "academy_members"]);
            return;
          }
          setError(memberError.message);
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
        setError(membersError.message);
        return;
      }

      setMembers((memberRows ?? []) as AcademyMember[]);
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
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
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = createClient();
      const { data, error: saveError } = await supabase
        .from("academies")
        .update({
          name: academy.name.trim(),
          logo_url: academy.logo_url?.trim() || null,
          primary_color: academy.primary_color,
          secondary_color: academy.secondary_color,
          custom_domain: academy.custom_domain?.trim() || null,
          support_email: academy.support_email?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", academy.id)
        .select("id, name, logo_url, primary_color, secondary_color, custom_domain, support_email")
        .single();

      if (saveError) {
        setError(saveError.message);
        return;
      }

      setAcademy(data as AcademyBranding);
      setSuccess("Academy branding saved.");
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
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
        setError(
          `${uploadError.message}. Create a public Supabase storage bucket named "academy-logos" first.`,
        );
        return;
      }

      const { data } = supabase.storage.from("academy-logos").getPublicUrl(path);
      updateAcademy({ logo_url: data.publicUrl });
      setSuccess("Logo uploaded. Save settings to apply it.");
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="glass-panel flex items-center gap-3 rounded-2xl p-6 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading academy settings...
      </div>
    );
  }

  if (setupTables.length > 0) {
    return (
      <div className="space-y-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Academy Settings
          </h1>
          <p className="text-muted mt-1 max-w-2xl text-sm">
            Configure white-label branding, domains, support details, and academy
            membership for multi-coach teams.
          </p>
        </div>
        <SetupRequiredPanel
          {...getSetupRequiredMessage(setupTables)}
          tables={setupTables}
        />
      </div>
    );
  }

  if (!academy) {
    return (
      <div className="glass-panel rounded-2xl p-6 text-sm text-red-600 dark:text-red-400">
        {error ?? "Academy settings could not be loaded."}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Academy Settings
        </h1>
        <p className="text-muted mt-1 max-w-2xl text-sm">
          Configure white-label branding, domains, support details, and academy
          membership for multi-coach teams.
        </p>
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
            <Palette className="text-accent size-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              White-label branding
            </h2>
            <p className="text-muted mt-1 text-sm">
              These settings power the dashboard shell, reports, emails, and
              future academy domains.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium">Academy name</label>
            <input
              value={academy.name}
              onChange={(e) => updateAcademy({ name: e.target.value })}
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
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
              placeholder="academyname.coachflow.website"
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Support email</label>
            <input
              type="email"
              value={academy.support_email ?? ""}
              onChange={(e) => updateAcademy({ support_email: e.target.value })}
              placeholder="support@academy.com"
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
            />
          </div>

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
              <label className="border-border hover:bg-black/[0.03] inline-flex h-10 w-fit cursor-pointer items-center justify-center rounded-full border px-5 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]">
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

      <section className="glass-panel rounded-2xl p-6 sm:p-8">
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
