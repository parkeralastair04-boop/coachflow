import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getMinimumPlanForGateFeature } from "@/lib/feature-definitions";
import { hasFeatureAccess } from "@/lib/subscription";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT =
  "You are an elite football coaching assistant. Convert coaching notes into concise, professional, encouraging progress reports for parents. Highlight strengths, identify one or two development focuses, and maintain a positive and supportive tone.";

type GenerateReportBody = {
  playerName?: string;
  notes?: string;
};

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const allowed = await hasFeatureAccess("reports");
    if (!allowed) {
      return NextResponse.json(
        {
          error: "AI reports require a higher CoachFlow plan.",
          requiredPlan: getMinimumPlanForGateFeature("reports"),
        },
        { status: 403 },
      );
    }

    const body = (await request.json()) as GenerateReportBody;
    const playerName = body.playerName?.trim();
    const notes = body.notes?.trim();

    if (!playerName || !notes) {
      return NextResponse.json(
        { error: "playerName and notes are required." },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY environment variable." },
        { status: 500 },
      );
    }

    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Player: ${playerName}\n\nCoaching notes:\n${notes}\n\nWrite a concise parent progress report.`,
        },
      ],
      temperature: 0.6,
      max_output_tokens: 320,
    });

    const report = response.output_text?.trim();
    if (!report) {
      return NextResponse.json(
        { error: "The AI response was empty. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ report });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Failed to generate report.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
