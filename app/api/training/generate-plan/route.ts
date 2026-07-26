import OpenAI from "openai";
import { NextResponse } from "next/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  buildTrainingPlanUserPrompt,
  TRAINING_PLAN_SYSTEM_PROMPT,
} from "@/lib/training-ai";
import {
  createDefaultTimeline,
  TIMELINE_SECTION_LABELS,
  type TimelineSection,
  type TrainingDifficulty,
} from "@/lib/training-types";
import { hasFeatureAccess } from "@/lib/subscription";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type GeneratePlanBody = {
  ageGroup?: string;
  ability?: TrainingDifficulty;
  theme?: string;
  players?: string;
  durationMinutes?: string;
  objectives?: string;
  equipment?: string;
};

function parseAiJson(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.aiGenerate,
      route: "/api/training/generate-plan",
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

    const body = (await request.json()) as GeneratePlanBody;
    const ageGroup = body.ageGroup?.trim() || "U10";
    const ability = body.ability ?? "intermediate";
    const theme = body.theme?.trim() || "General development";
    const players = Number(body.players) || 12;
    const durationMinutes = Number(body.durationMinutes) || 60;
    const objectives = body.objectives?.trim() || "";
    const equipment = body.equipment?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: TRAINING_PLAN_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildTrainingPlanUserPrompt({
            ageGroup,
            ability,
            theme,
            players,
            durationMinutes,
            objectives,
            equipment,
          }),
        },
      ],
    });

    const parsed = parseAiJson(response.output_text?.trim() ?? "");
    if (!parsed) {
      return NextResponse.json({ error: "Unable to parse AI training plan." }, { status: 500 });
    }

    const drillPayloads = Array.isArray(parsed.drills) ? parsed.drills : [];
    const createdDrillIds: string[] = [];

    for (const drill of drillPayloads) {
      if (!drill || typeof drill !== "object") continue;
      const item = drill as Record<string, unknown>;
      const name = typeof item.name === "string" ? item.name : null;
      if (!name) continue;
      const { data: createdDrill, error: drillError } = await supabase
        .from("training_drills")
        .insert({
          coach_id: user.id,
          name,
          description: typeof item.description === "string" ? item.description : null,
          objectives: typeof item.objectives === "string" ? item.objectives : null,
          organisation: typeof item.organisation === "string" ? item.organisation : null,
          coaching_points: typeof item.coachingPoints === "string" ? item.coachingPoints : null,
          progressions: typeof item.progressions === "string" ? item.progressions : null,
          regressions: typeof item.regressions === "string" ? item.regressions : null,
          equipment: Array.isArray(item.equipment)
            ? item.equipment.map(String)
            : typeof item.equipment === "string"
              ? item.equipment.split(",").map((entry) => entry.trim())
              : [],
          duration_minutes:
            typeof item.durationMinutes === "number" ? item.durationMinutes : null,
          player_numbers: typeof item.playerNumbers === "string" ? item.playerNumbers : null,
          category: typeof item.category === "string" ? item.category : null,
          development_tags: Array.isArray(item.developmentTags)
            ? item.developmentTags.map(String)
            : [],
        })
        .select("id")
        .single();
      if (!drillError && createdDrill?.id) createdDrillIds.push(createdDrill.id as string);
    }

    const defaultTimeline = createDefaultTimeline();
    const aiTimeline = Array.isArray(parsed.timeline) ? parsed.timeline : [];
    const timeline: TimelineSection[] = defaultTimeline.map((section, index) => {
      const aiSection = aiTimeline[index] as Record<string, unknown> | undefined;
      const drillId = createdDrillIds[index] ?? null;
      return {
        ...section,
        title:
          typeof aiSection?.title === "string"
            ? aiSection.title
            : TIMELINE_SECTION_LABELS[section.sectionType],
        durationMinutes:
          typeof aiSection?.durationMinutes === "number"
            ? aiSection.durationMinutes
            : section.durationMinutes,
        notes: typeof aiSection?.notes === "string" ? aiSection.notes : null,
        drillId,
        order: index,
      };
    });

    const { data: plan, error: planError } = await supabase
      .from("training_plans")
      .insert({
        coach_id: user.id,
        title: typeof parsed.title === "string" ? parsed.title : `${theme} session`,
        age_group: ageGroup,
        theme: typeof parsed.theme === "string" ? parsed.theme : theme,
        objectives: typeof parsed.objectives === "string" ? parsed.objectives : objectives,
        expected_outcomes:
          typeof parsed.expectedOutcomes === "string" ? parsed.expectedOutcomes : null,
        coach_notes: typeof parsed.coachNotes === "string" ? parsed.coachNotes : null,
        duration_minutes: durationMinutes,
        difficulty: ability,
        equipment,
        development_focus: [],
        plan_data: {
          timeline,
          pitchLayout: { elements: [], updatedAt: null },
          reflection: null,
          linkedPlayerIds: [],
        },
      })
      .select("id")
      .single();

    if (planError || !plan) {
      if (createdDrillIds.length > 0) {
        await supabase.from("training_drills").delete().in("id", createdDrillIds);
      }
      return NextResponse.json({ error: planError?.message ?? "Unable to save plan." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, planId: plan.id });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to generate training plan.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
