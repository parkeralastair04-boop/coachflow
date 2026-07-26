import { NextResponse } from "next/server";
import { getAuthenticatedUser, getServerSupabase } from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasFeatureAccess } from "@/lib/subscription";

export type VideoAccessContext =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
      coachId: string;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireVideoAccess(): Promise<VideoAccessContext> {
  const allowed = await hasFeatureAccess("video_analysis");
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Video Analysis is available on Pro and Academy." },
        { status: 403 },
      ),
    };
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You must be signed in to use video analysis." },
        { status: 401 },
      ),
    };
  }

  const supabase = await getServerSupabase();
  return { ok: true, supabase, coachId: user.id };
}
