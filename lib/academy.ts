import { cache } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { AcademyBranding } from "@/lib/academy-shared";
import { getAuthenticatedUser, getServerSupabase, logAuthTiming } from "@/lib/auth/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

/**
 * Primary academy for the signed-in coach — cached per request.
 */
export const getAcademyForUser = cache(
  async (userId: string): Promise<AcademyBranding | null> => {
    const startedAt = performance.now();
    try {
      const supabase = await getServerSupabase();
      const { data, error } = await supabase
        .from("academy_members")
        .select(
          "academy:academies(id, name, logo_url, primary_color, secondary_color, custom_domain, support_email)",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;
      const academy = data.academy as AcademyBranding | AcademyBranding[] | null;
      return Array.isArray(academy) ? (academy[0] ?? null) : academy;
    } finally {
      logAuthTiming("getAcademyForUser", startedAt);
    }
  },
);

/** Convenience: resolve academy for the current authenticated user. */
export const getCurrentAcademy = cache(async (): Promise<AcademyBranding | null> => {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  return getAcademyForUser(user.id);
});

export async function getPublicAcademyForCoach(
  coachId: string,
): Promise<AcademyBranding | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.rpc("get_public_academy_by_coach", {
    p_coach_id: coachId,
  });
  if (error || !Array.isArray(data) || data.length === 0) return null;
  return data[0] as AcademyBranding;
}
