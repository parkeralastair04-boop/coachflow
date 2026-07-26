import { createPublicSupabaseClient } from "@/lib/public-booking";
import type { BookingPortalTenantFromPath } from "@/lib/error-experience";

export async function loadBookingSupportEmail(
  tenant: BookingPortalTenantFromPath,
): Promise<string | null> {
  try {
    const supabase = createPublicSupabaseClient();
    const { data, error } =
      tenant.kind === "coach"
        ? await supabase.rpc("get_public_portal_by_coach_slug", {
            p_slug: tenant.slug,
          })
        : await supabase.rpc("get_public_portal_by_academy_slug", {
            p_slug: tenant.slug,
          });

    if (error || !Array.isArray(data) || data.length === 0) {
      return null;
    }

    const supportEmail = (data[0] as { support_email?: string | null }).support_email;
    return supportEmail?.trim() || null;
  } catch {
    return null;
  }
}
