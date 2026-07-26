import OpenAI from "openai";
import { NextResponse } from "next/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  buildTrainingReflectionUserPrompt,
  TRAINING_REFLECTION_SYSTEM_PROMPT,
} from "@/lib/training-ai";
import { parseTrainingPlanData } from "@/lib/training-types";
import { hasFeatureAccess } from "@/lib/subscription";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.aiGenerate,
      route: "/api/training/generate-reflection",
    });
    if (limited) return limited;

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    if (!(await hasFeatureAccess("training_planner"))) {
      return NextResponse.json({ error: "Training Planner is not on your plan." }, { status: 403 });
    }

    const body = (await request.json()) as {
      planId?: string;
      reflection?: {
        wentWell?: string | null;
        needsImproving?: string | null;
        attendanceImpact?: string | null;
        coachNotes?: string | null;
      };
    };

    const planId = body.planId?.trim();
    if (!planId) {
      return NextResponse.json({ error: "planId is required." }, { status: 400 });
    }

    const { data: plan, error: planError } = await supabase
      .from("training_plans")
      .select("id, title")
      .eq("id", planId)
      .eq("coach_id", user.id)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Training plan not found." }, { status: 404 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: TRAINING_REFLECTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildTrainingReflectionUserPrompt({
            planTitle: plan.title as string,
            wentWell: body.reflection?.wentWell ?? "",
            needsImproving: body.reflection?.needsImproving ?? "",
            attendanceImpact: body.reflection?.attendanceImpact ?? "",
            coachNotes: body.reflection?.coachNotes ?? "",
          }),
        },
      ],
    });

    const raw = response.output_text?.trim() ?? "";
    let summary = raw;
    try {
      const parsed = JSON.parse(raw) as { summary?: string; followUpFocus?: string };
      summary = [parsed.summary, parsed.followUpFocus].filter(Boolean).join("\n\n");
    } catch {
      // Use raw text fallback.
    }

    const { data: existing } = await supabase
      .from("training_plans")
      .select("plan_data")
      .eq("id", planId)
      .single();

    const planData = parseTrainingPlanData(existing?.plan_data);
    const reflection = {
      wentWell: body.reflection?.wentWell ?? null,
      needsImproving: body.reflection?.needsImproving ?? null,
      attendanceImpact: body.reflection?.attendanceImpact ?? null,
      coachNotes: body.reflection?.coachNotes ?? null,
      followUpActions: null,
      aiSummary: summary,
      completedAt: new Date().toISOString(),
    };

    await supabase
      .from("training_plans")
      .update({
        plan_data: { ...planData, reflection },
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId)
      .eq("coach_id", user.id);

    return NextResponse.json({ ok: true, summary });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to summarise reflection.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
