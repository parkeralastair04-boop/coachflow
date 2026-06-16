import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_ACADEMY_BRANDING } from "@/lib/academy-shared";
import { parsePoundsToPence } from "@/lib/booking-system";
import { buildAcademySlug, buildCoachSlug } from "@/lib/slugify";

export type OnboardingCoachContext = {
  coachId: string;
  email: string | null;
  academyId: string | null;
  coachSlug: string | null;
  academySlug: string | null;
};

function getDisplayName(academyName: string, email: string | null): string {
  const trimmed = academyName.trim();
  if (trimmed) return trimmed;
  if (email) return email.split("@")[0] ?? "Coach";
  return "Coach";
}

export async function loadOnboardingCoachContext(
  supabase: SupabaseClient,
  coachId: string,
): Promise<OnboardingCoachContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("academy_members")
    .select("academy_id")
    .eq("user_id", coachId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const academyId = (membership?.academy_id as string | undefined) ?? null;

  const [{ data: profile }, { data: academy }] = await Promise.all([
    supabase.from("coach_public_profiles").select("slug").eq("coach_id", coachId).maybeSingle(),
    academyId
      ? supabase.from("academies").select("slug, name").eq("id", academyId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    coachId,
    email: user?.email ?? null,
    academyId,
    coachSlug: (profile?.slug as string | undefined) ?? null,
    academySlug: (academy?.slug as string | undefined) ?? null,
  };
}

export async function saveAcademyBusinessName(
  supabase: SupabaseClient,
  args: { coachId: string; email: string | null; businessName: string },
): Promise<OnboardingCoachContext> {
  const name = args.businessName.trim();
  if (!name) {
    throw new Error("Academy or business name is required.");
  }

  const { data: membership } = await supabase
    .from("academy_members")
    .select("academy_id")
    .eq("user_id", args.coachId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let academyId = (membership?.academy_id as string | undefined) ?? null;

  if (!academyId) {
    const { data: created, error: createError } = await supabase
      .from("academies")
      .insert({
        ...DEFAULT_ACADEMY_BRANDING,
        name,
        support_email: args.email,
      })
      .select("id")
      .single();

    if (createError || !created) {
      throw new Error(createError?.message ?? "Could not create your academy.");
    }

    academyId = created.id as string;

    const { error: memberError } = await supabase.from("academy_members").insert({
      academy_id: academyId,
      user_id: args.coachId,
      role: "owner",
    });

    if (memberError) {
      throw new Error(memberError.message);
    }
  } else {
    const { error: updateError } = await supabase
      .from("academies")
      .update({ name, support_email: args.email })
      .eq("id", academyId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  const academySlug = buildAcademySlug(name, academyId);
  await supabase.from("academies").update({ slug: academySlug }).eq("id", academyId);

  const displayName = getDisplayName(name, args.email);
  const coachSlug = buildCoachSlug(displayName, args.coachId);

  const { error: profileError } = await supabase.from("coach_public_profiles").upsert(
    {
      coach_id: args.coachId,
      academy_id: academyId,
      slug: coachSlug,
      display_name: displayName,
      primary_color: DEFAULT_ACADEMY_BRANDING.primary_color,
      secondary_color: DEFAULT_ACADEMY_BRANDING.secondary_color,
      support_email: args.email,
      booking_enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "coach_id" },
  );

  if (profileError) {
    throw new Error(profileError.message);
  }

  return {
    coachId: args.coachId,
    email: args.email,
    academyId,
    coachSlug,
    academySlug,
  };
}

export async function createOnboardingPlayer(
  supabase: SupabaseClient,
  args: {
    coachId: string;
    academyId: string | null;
    playerName: string;
    parentEmail?: string;
  },
): Promise<void> {
  const playerName = args.playerName.trim();
  if (!playerName) {
    throw new Error("Player name is required.");
  }

  const { error } = await supabase.from("players").insert({
    coach_id: args.coachId,
    academy_id: args.academyId,
    player_name: playerName,
    preferred_foot: "Unknown",
    secondary_positions: [],
    parent_email: args.parentEmail?.trim() || null,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function createOnboardingTeam(
  supabase: SupabaseClient,
  args: {
    coachId: string;
    academyId: string | null;
    teamName: string;
    ageGroup?: string;
  },
): Promise<void> {
  const teamName = args.teamName.trim();
  if (!teamName) {
    throw new Error("Team name is required.");
  }

  const { error } = await supabase.from("teams").insert({
    coach_id: args.coachId,
    academy_id: args.academyId,
    team_name: teamName,
    age_group: args.ageGroup?.trim() || null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function createOnboardingSession(
  supabase: SupabaseClient,
  args: {
    coachId: string;
    academyId: string | null;
    sessionDateTime: string;
    sessionType: string;
    location?: string;
    durationMinutes?: number;
    capacity?: number;
  },
): Promise<void> {
  if (!args.sessionDateTime) {
    throw new Error("Session date and time are required.");
  }

  const sessionType = args.sessionType.trim() || "Group Session";
  const durationMinutes = args.durationMinutes ?? 60;
  const capacity = args.capacity ?? 8;

  const { error } = await supabase.from("sessions").insert({
    coach_id: args.coachId,
    academy_id: args.academyId,
    session_date: new Date(args.sessionDateTime).toISOString(),
    session_type: sessionType,
    location: args.location?.trim() || null,
    attendance_status: "scheduled",
    duration_minutes: durationMinutes,
    price: parsePoundsToPence("0"),
    capacity,
    is_public: true,
    booking_enabled: true,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchOnboardingCounts(
  supabase: SupabaseClient,
  coachId: string,
): Promise<{ hasPlayer: boolean; hasTeam: boolean; hasSession: boolean }> {
  const [players, teams, sessions] = await Promise.all([
    supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", coachId),
    supabase.from("teams").select("id", { count: "exact", head: true }).eq("coach_id", coachId),
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", coachId),
  ]);

  return {
    hasPlayer: (players.count ?? 0) > 0,
    hasTeam: (teams.count ?? 0) > 0,
    hasSession: (sessions.count ?? 0) > 0,
  };
}

export function resolveBookingPortalUrl(context: OnboardingCoachContext): string | null {
  const origin = getClientPortalOrigin();
  if (context.academySlug) {
    return `${origin}/academy/${context.academySlug}/book`;
  }
  if (context.coachSlug) {
    return `${origin}/book/${context.coachSlug}`;
  }
  return null;
}

function getClientPortalOrigin(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin.replace(/\/$/, "");
  return "";
}
