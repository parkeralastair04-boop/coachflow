import OpenAI from "openai";
import { NextResponse } from "next/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireVideoAccess } from "@/lib/video-access";
import {
  buildVideoClipSummaryUserPrompt,
  parseVideoClipSummaryResponse,
  VIDEO_CLIP_SUMMARY_SYSTEM_PROMPT,
} from "@/lib/video-ai";
import { formatAiClipSummaryText, CLIP_CATEGORY_LABELS, type ClipCategory } from "@/lib/video-types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.aiGenerate,
      route: "/api/video/generate-summary",
    });
    if (limited) return limited;

    const access = await requireVideoAccess();
    if (!access.ok) return access.response;

    const body = (await request.json()) as {
      clipId?: string;
      title?: string;
      category?: string;
      description?: string;
      coachingPoint?: string;
      developmentTags?: string[];
      playerNames?: string[];
    };

    const clipId = body.clipId?.trim();
    if (!clipId) {
      return NextResponse.json({ error: "clipId is required." }, { status: 400 });
    }

    const { data: clip, error: clipError } = await access.supabase
      .from("video_clips")
      .select("id, title, category, description, coaching_point, development_tags")
      .eq("id", clipId)
      .eq("coach_id", access.coachId)
      .single();

    if (clipError || !clip) {
      return NextResponse.json({ error: "Clip not found." }, { status: 404 });
    }

    const { data: playerLinks } = await access.supabase
      .from("video_clip_players")
      .select("player_id, player:players(player_name)")
      .eq("clip_id", clipId);

    const playerNames =
      body.playerNames ??
      ((playerLinks ?? []) as Array<{ player?: { player_name?: string } | { player_name?: string }[] | null }>)
        .map((link) => {
          const player = Array.isArray(link.player) ? link.player[0] : link.player;
          return player?.player_name ?? "";
        })
        .filter(Boolean);

    const category = (body.category ?? clip.category) as ClipCategory;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: VIDEO_CLIP_SUMMARY_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildVideoClipSummaryUserPrompt({
            title: body.title ?? (clip.title as string),
            category: CLIP_CATEGORY_LABELS[category] ?? category,
            description: body.description ?? (clip.description as string | null) ?? "",
            coachingPoint: body.coachingPoint ?? (clip.coaching_point as string | null) ?? "",
            developmentTags:
              body.developmentTags ?? ((clip.development_tags as string[] | null) ?? []),
            playerNames,
          }),
        },
      ],
    });

    const summary = parseVideoClipSummaryResponse(response.output_text?.trim() ?? "");
    const aiSummary = formatAiClipSummaryText(summary);

    const { error: updateError } = await access.supabase
      .from("video_clips")
      .update({
        ai_summary: aiSummary,
        clip_data: { aiSummary: summary },
        updated_at: new Date().toISOString(),
      })
      .eq("id", clipId)
      .eq("coach_id", access.coachId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ summary, aiSummary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate clip summary.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
