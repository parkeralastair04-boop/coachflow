import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type {
  PublicRecurringSeriesRow,
  PublicSessionRow,
} from "@/lib/booking-system";
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

export async function resolvePublicPortal(
  tenant: PublicPortalTenant,
): Promise<PublicPortal | null> {
  const supabase = createPublicSupabaseClient();
  const { data, error } =
    tenant.kind === "coach"
      ? await supabase.rpc("get_public_portal_by_coach_slug", {
          p_slug: tenant.slug,
        })
      : await supabase.rpc("get_public_portal_by_academy_slug", {
          p_slug: tenant.slug,
        });

  if (error) {
    throw error;
  }

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return data[0] as PublicPortal;
}

export async function loadPublicBookingPayload(
  tenant: PublicPortalTenant,
): Promise<PublicBookingPayload | null> {
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
