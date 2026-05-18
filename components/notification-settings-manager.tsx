"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { BellRing, Loader2, Save, Smartphone, ToggleLeft, ToggleRight } from "lucide-react";
import {
  PUSH_NOTIFICATION_TEMPLATES,
  PUSH_NOTIFICATION_TYPES,
  type PushNotificationType,
} from "@/lib/push-notifications";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type NotificationPreferences = Record<PushNotificationType, boolean>;

type DeviceToken = {
  id: string;
  platform: string;
  token: string;
  created_at: string;
};

const defaultPreferences = Object.fromEntries(
  PUSH_NOTIFICATION_TYPES.map((type) => [type, true]),
) as NotificationPreferences;

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

function getPlatform() {
  const platform = Capacitor.getPlatform();
  if (platform === "ios" || platform === "android") return platform;
  return "web";
}

export function NotificationSettingsManager() {
  const [userId, setUserId] = useState("");
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [tokens, setTokens] = useState<DeviceToken[]>([]);
  const [permissionStatus, setPermissionStatus] = useState("unknown");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const nativePushSupported = useMemo(
    () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("PushNotifications"),
    [],
  );

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
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
        setError("You must be signed in to manage notification settings.");
        return;
      }

      setUserId(user.id);
      const [{ data: prefData, error: prefError }, { data: tokenData, error: tokenError }] =
        await Promise.all([
          supabase
            .from("notification_preferences")
            .select(
              "upcoming_sessions, new_bookings, payment_failures, camp_enrolments, ai_report_completed, referral_conversions",
            )
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("device_tokens")
            .select("id, platform, token, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
        ]);

      if (prefError) {
        setError(prefError.message);
        return;
      }
      if (tokenError) {
        setError(tokenError.message);
        return;
      }

      if (prefData) {
        setPreferences({ ...defaultPreferences, ...(prefData as NotificationPreferences) });
      } else {
        const { error: insertError } = await supabase
          .from("notification_preferences")
          .insert({ user_id: user.id, ...defaultPreferences });
        if (insertError) {
          setError(insertError.message);
          return;
        }
      }
      setTokens((tokenData ?? []) as DeviceToken[]);

      if (nativePushSupported) {
        const status = await PushNotifications.checkPermissions();
        setPermissionStatus(status.receive);
      } else if ("Notification" in window) {
        setPermissionStatus(Notification.permission);
      } else {
        setPermissionStatus("unsupported");
      }
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [nativePushSupported]);

  useEffect(() => {
    async function init() {
      await loadSettings();
    }

    void init();
  }, [loadSettings]);

  async function savePreferences() {
    if (!userId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const supabase = createClient();
      const { error: saveError } = await supabase
        .from("notification_preferences")
        .upsert(
          {
            user_id: userId,
            ...preferences,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

      if (saveError) {
        setError(saveError.message);
        return;
      }
      setSuccess("Notification preferences saved.");
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function storeToken(token: string) {
    const supabase = createClient();
    const { error: upsertError } = await supabase.from("device_tokens").upsert(
      {
        user_id: userId,
        platform: getPlatform(),
        token,
      },
      { onConflict: "user_id,token" },
    );

    if (upsertError) throw upsertError;
    await loadSettings();
  }

  async function registerDevice() {
    if (!userId) return;
    setRegistering(true);
    setError(null);
    setSuccess(null);

    try {
      if (!nativePushSupported) {
        setError("Native push notifications are only available in the iOS or Android app.");
        return;
      }

      const permission = await PushNotifications.requestPermissions();
      setPermissionStatus(permission.receive);
      if (permission.receive !== "granted") {
        setError("Push notification permission was not granted.");
        return;
      }

      await PushNotifications.removeAllListeners();
      await PushNotifications.addListener("registration", (token) => {
        void storeToken(token.value)
          .then(() => setSuccess("Device registered for push notifications."))
          .catch((caughtError: unknown) => setError(getErrorMessage(caughtError)));
      });
      await PushNotifications.addListener("registrationError", (registrationError) => {
        setError(registrationError.error);
      });
      await PushNotifications.register();
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setRegistering(false);
    }
  }

  function togglePreference(type: PushNotificationType) {
    setPreferences((current) => ({
      ...current,
      [type]: !current[type],
    }));
  }

  if (loading) {
    return (
      <div className="glass-panel flex items-center gap-3 rounded-2xl p-6 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading notification settings...
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Notification Settings
        </h1>
        <p className="text-muted mt-1 max-w-2xl text-sm">
          Register this device for native alerts and choose which CoachFlow
          events should trigger push notifications.
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
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="bg-accent/10 ring-accent/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
              <Smartphone className="text-accent size-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Device registration
              </h2>
              <p className="text-muted mt-1 text-sm">
                Permission: <span className="text-foreground">{permissionStatus}</span>
                {" · "}
                Registered devices: <span className="text-foreground">{tokens.length}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void registerDevice()}
            disabled={registering || !nativePushSupported}
            className="bg-foreground text-background hover:opacity-90 inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity disabled:opacity-60"
          >
            {registering ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Registering...
              </>
            ) : (
              "Enable push notifications"
            )}
          </button>
        </div>
        {!nativePushSupported ? (
          <p className="text-muted mt-4 text-sm">
            Open CoachFlow from the iOS or Android Capacitor app to register a
            native push token.
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {PUSH_NOTIFICATION_TYPES.map((type) => {
          const template = PUSH_NOTIFICATION_TEMPLATES[type];
          const enabled = preferences[type];
          return (
            <article key={type} className="glass-panel rounded-2xl p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="bg-accent/10 ring-accent/20 flex size-10 shrink-0 items-center justify-center rounded-xl ring-1">
                    <BellRing className="text-accent size-5" aria-hidden />
                  </div>
                  <div>
                    <h3 className="font-semibold tracking-tight">{template.title}</h3>
                    <p className="text-muted mt-1 text-sm">{template.body}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => togglePreference(type)}
                  className={cn(
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors",
                    enabled
                      ? "bg-accent/10 text-accent ring-accent/25"
                      : "text-muted ring-border hover:text-foreground",
                  )}
                >
                  {enabled ? (
                    <ToggleRight className="mr-1.5 size-4" aria-hidden />
                  ) : (
                    <ToggleLeft className="mr-1.5 size-4" aria-hidden />
                  )}
                  {enabled ? "On" : "Off"}
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <button
        type="button"
        onClick={() => void savePreferences()}
        disabled={saving}
        className="bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60"
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            Saving...
          </>
        ) : (
          <>
            <Save className="mr-2 size-4" aria-hidden />
            Save preferences
          </>
        )}
      </button>
    </div>
  );
}
