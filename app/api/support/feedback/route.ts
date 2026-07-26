import { NextResponse } from "next/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { FEEDBACK_CATEGORIES, isFeedbackCategory } from "@/lib/product-feedback";
import {
  getSetupRequiredMessage,
  isMissingTableError,
} from "@/lib/supabase-errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type FeedbackBody = {
  category?: string;
  rating?: number;
  title?: string;
  feedback?: string;
  page?: string;
};

function parseRating(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    if (parsed >= 1 && parsed <= 5) return parsed;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.support,
      route: "/api/support/feedback",
    });
    if (limited) return limited;

    const body = (await request.json()) as FeedbackBody;
    const category = body.category?.trim() ?? "";
    const rating = parseRating(body.rating);
    const title = body.title?.trim() ?? "";
    const feedback = body.feedback?.trim() ?? "";
    const page = body.page?.trim() ?? "";

    if (!isFeedbackCategory(category)) {
      return NextResponse.json(
        {
          error: `Please select a valid category (${FEEDBACK_CATEGORIES.map((value) => value).join(", ")}).`,
        },
        { status: 400 },
      );
    }
    if (rating === null) {
      return NextResponse.json({ error: "Please select a rating from 1 to 5." }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    if (!feedback) {
      return NextResponse.json({ error: "Feedback is required." }, { status: 400 });
    }
    if (!page) {
      return NextResponse.json({ error: "Page context is required." }, { status: 400 });
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
      return NextResponse.json(
        { error: "You must be signed in to submit feedback." },
        { status: 401 },
      );
    }

    const { data, error } = await supabase
      .from("support_feedback")
      .insert({
        user_id: user.id,
        user_email: user.email ?? null,
        category,
        rating,
        title,
        feedback,
        page,
      })
      .select("id, created_at")
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        const setup = getSetupRequiredMessage(["support_feedback"]);
        return NextResponse.json(
          {
            setupRequired: true,
            message: setup.description,
            tables: ["support_feedback"],
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id, createdAt: data?.created_at });
  } catch {
    return NextResponse.json({ error: "Unable to submit feedback." }, { status: 500 });
  }
}
