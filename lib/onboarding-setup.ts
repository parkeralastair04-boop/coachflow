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

type CreateAcademyRpcRow = {
  academy_id: string;
  academy_slug: string;
  coach_slug: string;
};

function getDisplayName(academyName: string, email: string | null): string {
  const trimmed = academyName.trim();
  if (trimmed) return trimmed;
  if (email) return email.split("@")[0] ?? "Coach";
  return "Coach";
}

function isMissingRpcError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST202" ||
    message.includes("could not find the function") ||
    message.includes("create_or_update_coach_academy")
  );
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

/**
 * Creates/updates academy + owner membership + booking profile atomically via RPC.
 * Falls back to compensated client writes if the RPC is not yet migrated.
 */
export async function saveAcademyBusinessName(
  supabase: SupabaseClient,
  args: { coachId: string; email: string | null; businessName: string },
): Promise<OnboardingCoachContext> {
  const name = args.businessName.trim();
  if (!name) {
    throw new Error("Academy or business name is required.");
  }

  const { data, error } = await supabase.rpc("create_or_update_coach_academy", {
    p_name: name,
    p_support_email: args.email,
    p_primary_color: DEFAULT_ACADEMY_BRANDING.primary_color,
    p_secondary_color: DEFAULT_ACADEMY_BRANDING.secondary_color,
  });

  if (!error) {
    const row = (Array.isArray(data) ? data[0] : data) as CreateAcademyRpcRow | null;
    if (!row?.academy_id) {
      throw new Error("Could not create your academy.");
    }
    return {
      coachId: args.coachId,
      email: args.email,
      academyId: row.academy_id,
      coachSlug: row.coach_slug,
      academySlug: row.academy_slug,
    };
  }

  if (!isMissingRpcError(error)) {
    throw new Error(error.message || "Could not create your academy.");
  }

  return saveAcademyBusinessNameCompensated(supabase, args);
}

/** Legacy path with compensation — used only when RPC migration is absent. */
async function saveAcademyBusinessNameCompensated(
  supabase: SupabaseClient,
  args: { coachId: string; email: string | null; businessName: string },
): Promise<OnboardingCoachContext> {
  const name = args.businessName.trim();

  const { data: membership } = await supabase
    .from("academy_members")
    .select("academy_id")
    .eq("user_id", args.coachId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let academyId = (membership?.academy_id as string | undefined) ?? null;
  let createdAcademyId: string | null = null;

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
    createdAcademyId = academyId;

    const { error: memberError } = await supabase.from("academy_members").insert({
      academy_id: academyId,
      user_id: args.coachId,
      role: "owner",
    });

    if (memberError) {
      await supabase.from("academies").delete().eq("id", academyId);
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
  const { error: slugError } = await supabase
    .from("academies")
    .update({ slug: academySlug })
    .eq("id", academyId);

  if (slugError) {
    if (createdAcademyId) {
      await supabase.from("academies").delete().eq("id", createdAcademyId);
    }
    throw new Error(slugError.message || "Could not publish your academy booking page.");
  }

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
    if (createdAcademyId) {
      await supabase.from("academies").delete().eq("id", createdAcademyId);
    }
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
): Promise<{
  hasPlayer: boolean;
  hasTeam: boolean;
  hasSession: boolean;
  hasBooking: boolean;
  hasAcademy: boolean;
  hasBookingPage: boolean;
}> {
  const [players, teams, sessions, bookings, membership, profile] =
    await Promise.all([
      supabase
        .from("players")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", coachId),
      supabase
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", coachId),
      supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", coachId),
      supabase
        .from("session_bookings")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", coachId)
        .in("booking_status", ["confirmed", "waitlist"]),
      supabase
        .from("academy_members")
        .select("academy_id", { count: "exact", head: true })
        .eq("user_id", coachId),
      supabase
        .from("coach_public_profiles")
        .select("slug, booking_enabled")
        .eq("coach_id", coachId)
        .maybeSingle(),
    ]);

  const hasBookingPage = Boolean(
    profile.data?.slug && profile.data?.booking_enabled === true,
  );

  return {
    hasPlayer: (players.count ?? 0) > 0,
    hasTeam: (teams.count ?? 0) > 0,
    hasSession: (sessions.count ?? 0) > 0,
    hasBooking: (bookings.count ?? 0) > 0,
    hasAcademy: (membership.count ?? 0) > 0,
    hasBookingPage,
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
