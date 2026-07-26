import type { AiClipSummary } from "@/lib/video-types";

export const VIDEO_CLIP_SUMMARY_SYSTEM_PROMPT = `You are an Awarix video intelligence assistant for grassroots football coaches, writing in British English.
Be supportive, clear, and practical. Avoid jargon-heavy analysis.
Return strict JSON with keys: whatHappened, positiveActions, areasToImprove, suggestedCoachingPoint.
Each value should be 1-3 short sentences suitable for coaches and parents.`;

export function buildVideoClipSummaryUserPrompt(args: {
  title: string;
  category: string;
  description: string;
  coachingPoint: string;
  developmentTags: string[];
  playerNames: string[];
}): string {
  return [
    `Clip title: ${args.title}`,
    `Category: ${args.category}`,
    `Players: ${args.playerNames.join(", ") || "Not specified"}`,
    `Development themes: ${args.developmentTags.join(", ") || "None"}`,
    `Coach description: ${args.description || "None"}`,
    `Existing coaching point: ${args.coachingPoint || "None"}`,
    "",
    "Write a supportive clip summary for a grassroots academy.",
  ].join("\n");
}

export function parseVideoClipSummaryResponse(raw: string): AiClipSummary {
  try {
    const parsed = JSON.parse(raw) as Partial<AiClipSummary>;
    return {
      whatHappened: parsed.whatHappened?.trim() || "The clip shows a useful teaching moment.",
      positiveActions:
        parsed.positiveActions?.trim() || "There are clear positives to reinforce with the player.",
      areasToImprove:
        parsed.areasToImprove?.trim() || "One or two details can be refined in the next session.",
      suggestedCoachingPoint:
        parsed.suggestedCoachingPoint?.trim() || "Keep the next coaching point short and specific.",
    };
  } catch {
    return {
      whatHappened: raw.trim() || "The clip shows a useful teaching moment.",
      positiveActions: "There are clear positives to reinforce with the player.",
      areasToImprove: "One or two details can be refined in the next session.",
      suggestedCoachingPoint: "Keep the next coaching point short and specific.",
    };
  }
}
