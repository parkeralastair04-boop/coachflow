import { NextResponse } from "next/server";
import { getAutomationTemplate } from "@/lib/automations";
import { getAuthenticatedUser, getServerSupabase } from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasFeatureAccess } from "@/lib/subscription";

export type CommunicationAccessContext =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
      coachId: string;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireCommunicationAccess(): Promise<CommunicationAccessContext> {
  const allowed = await hasFeatureAccess("parent_emails");
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Parent email communication is available on Pro and Academy." },
        { status: 403 },
      ),
    };
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You must be signed in to use the communication centre." },
        { status: 401 },
      ),
    };
  }

  const supabase = await getServerSupabase();
  return { ok: true, supabase, coachId: user.id };
}

export function getAutomationScheduleLabel(type: string, timingOffset: number): string {
  const template = getAutomationTemplate(type as never);
  if (!template) return `Scheduled (${timingOffset})`;
  return `${template.offsetLabel}: ${timingOffset}`;
}
