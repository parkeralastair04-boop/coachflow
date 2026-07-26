import { NextResponse } from "next/server";
import { enforceBotProtection } from "@/lib/bot-protection";
import { HONEYPOT_FIELD_NAME } from "@/lib/bot-protection-shared";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-response";

type PreflightBody = {
  action?: "login" | "signup" | "password_reset";
  turnstileToken?: string;
  [key: string]: unknown;
};

/**
 * Rate-limit + bot gate for client-side Supabase auth flows.
 * Call before signIn / signUp / resetPasswordForEmail.
 */
export async function POST(request: Request) {
  const route = "/api/auth/preflight";
  try {
    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.authRelated,
      route,
    });
    if (limited) return limited;

    const body = (await request.json().catch(() => ({}))) as PreflightBody;
    const bot = await enforceBotProtection({
      request,
      route,
      input: {
        honeypot:
          typeof body[HONEYPOT_FIELD_NAME] === "string"
            ? (body[HONEYPOT_FIELD_NAME] as string)
            : "",
        turnstileToken: body.turnstileToken,
      },
    });
    if (!bot.ok) {
      if (bot.code === "honeypot") {
        return NextResponse.json({ ok: true });
      }
      return apiError(400, bot.message, "bot_blocked");
    }

    return NextResponse.json({ ok: true });
  } catch {
    return apiError(500, "Unable to continue right now.", "internal_error");
  }
}
