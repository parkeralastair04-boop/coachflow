import { cache } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type {
  PublicRecurringSeriesRow,
  PublicSessionRow,
} from "@/lib/booking-system";
import { isDemoTenantSlug } from "@/lib/demo/constants";
import {
  getDemoPublicPortal,
  getDemoRecurringSeries,
  getDemoSessions,
} from "@/lib/demo/data";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

export type PublicPortal = {
  portal_kind: "coach" | "academy";
  coach_id: string | null;
  academy_id: string | null;
  coach_slug: string | null;
  academy_slug: string | null;
  display_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  support_email: string | null;
  support_phone?: string | null;
  booking_enabled: boolean;
};

export type PublicPortalTenant =
  | { kind: "coach"; slug: string }
  | { kind: "academy"; slug: string };

export type PublicBookingPayload = {
  portal: PublicPortal;
  sessions: PublicSessionRow[];
  recurringSeries: PublicRecurringSeriesRow[];
};

export function createPublicSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
}

export function getPortalQueryValue(tenant: PublicPortalTenant): string {
  return `${tenant.kind}Slug=${encodeURIComponent(tenant.slug)}`;
}

const resolvePublicPortalCached = cache(
  async (kind: PublicPortalTenant["kind"], slug: string): Promise<PublicPortal | null> => {
    if (isDemoTenantSlug(kind, slug)) {
      return getDemoPublicPortal();
    }

    const supabase = createPublicSupabaseClient();
    const { data, error } =
      kind === "coach"
        ? await supabase.rpc("get_public_portal_by_coach_slug", {
            p_slug: slug,
          })
        : await supabase.rpc("get_public_portal_by_academy_slug", {
            p_slug: slug,
          });

    if (error) {
      throw error;
    }

    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    return data[0] as PublicPortal;
  },
);

export async function resolvePublicPortal(
  tenant: PublicPortalTenant,
): Promise<PublicPortal | null> {
  return resolvePublicPortalCached(tenant.kind, tenant.slug);
}

export async function loadPublicBookingPayload(
  tenant: PublicPortalTenant,
): Promise<PublicBookingPayload | null> {
  if (isDemoTenantSlug(tenant.kind, tenant.slug)) {
    return {
      portal: getDemoPublicPortal(),
      sessions: getDemoSessions().filter(
        (session) => new Date(session.session_date).getTime() >= Date.now() - 60_000,
      ),
      recurringSeries: getDemoRecurringSeries(),
    };
  }

  const supabase = createPublicSupabaseClient();
  const portal = await resolvePublicPortal(tenant);

  if (!portal) {
    return null;
  }

  const [
    { data: sessionsData, error: sessionsError },
    { data: recurringData, error: recurringError },
  ] = await Promise.all([
    supabase.rpc("list_public_sessions_for_portal", {
      p_coach_slug: tenant.kind === "coach" ? tenant.slug : null,
      p_academy_slug: tenant.kind === "academy" ? tenant.slug : null,
    }),
    supabase.rpc("list_public_recurring_series_for_portal", {
      p_coach_slug: tenant.kind === "coach" ? tenant.slug : null,
      p_academy_slug: tenant.kind === "academy" ? tenant.slug : null,
    }),
  ]);

  if (sessionsError) {
    throw sessionsError;
  }
  if (recurringError) {
    throw recurringError;
  }

  return {
    portal,
    sessions: (sessionsData ?? []) as PublicSessionRow[],
    recurringSeries: (recurringData ?? []) as PublicRecurringSeriesRow[],
  };
}
