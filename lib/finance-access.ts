import { NextResponse } from "next/server";
import { getAuthenticatedUser, getServerSupabase } from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasFeatureAccess } from "@/lib/subscription";

export type FinanceAccessContext =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
      coachId: string;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireFinanceAccess(): Promise<FinanceAccessContext> {
  const allowed = await hasFeatureAccess("finance_centre");
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Finance Centre is available on the Academy plan." },
        { status: 403 },
      ),
    };
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You must be signed in to use the finance centre." },
        { status: 401 },
      ),
    };
  }

  const supabase = await getServerSupabase();
  return { ok: true, supabase, coachId: user.id };
}
