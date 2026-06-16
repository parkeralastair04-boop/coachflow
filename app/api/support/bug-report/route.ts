import { NextResponse } from "next/server";
import {
  BUG_PAGE_FEATURES,
  BUG_PRIORITIES,
  type BugPageFeature,
  type BugPriority,
} from "@/lib/help-support";
import {
  getSetupRequiredMessage,
  isMissingTableError,
} from "@/lib/supabase-errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type BugReportBody = {
  title?: string;
  description?: string;
  pageFeature?: string;
  priority?: string;
};

function isBugPriority(value: string): value is BugPriority {
  return (BUG_PRIORITIES as readonly string[]).includes(value);
}

function isBugPageFeature(value: string): value is BugPageFeature {
  return (BUG_PAGE_FEATURES as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BugReportBody;
    const title = body.title?.trim() ?? "";
    const description = body.description?.trim() ?? "";
    const pageFeature = body.pageFeature?.trim() ?? "";
    const priority = body.priority?.trim() ?? "";

    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: "Description is required." }, { status: 400 });
    }
    if (!isBugPageFeature(pageFeature)) {
      return NextResponse.json({ error: "Please select a valid page or feature." }, { status: 400 });
    }
    if (!isBugPriority(priority)) {
      return NextResponse.json({ error: "Please select a valid priority." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json({ error: "You must be signed in to report a bug." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("support_bug_reports")
      .insert({
        user_id: user.id,
        user_email: user.email ?? null,
        title,
        description,
        page_feature: pageFeature,
        priority,
      })
      .select("id, created_at")
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        const setup = getSetupRequiredMessage(["support_bug_reports"]);
        return NextResponse.json(
          {
            setupRequired: true,
            message: setup.description,
            tables: ["support_bug_reports"],
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id, createdAt: data?.created_at });
  } catch {
    return NextResponse.json({ error: "Unable to submit bug report." }, { status: 500 });
  }
}
