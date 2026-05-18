import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { AcademyBranding } from "@/lib/academy-shared";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

export async function getAcademyForUser(
  userId: string,
): Promise<AcademyBranding | null> {
  const supabase = await createServerSupabaseClient();
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
}

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
