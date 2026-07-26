import "server-only";

import { createHash } from "node:crypto";
import { logAbuseEvent } from "@/lib/abuse-log";
import { getRequestIp, hashIp } from "@/lib/rate-limit";

export { HONEYPOT_FIELD_NAME } from "@/lib/bot-protection-shared";

const recentContactHashes = new Map<string, number>();
const DUPLICATE_TTL_MS = 10 * 60_000;

export type BotProtectionInput = {
  /** Honeypot value from the form (should be empty). */
  honeypot?: string | null;
  /** Cloudflare Turnstile token when enabled. */
  turnstileToken?: string | null;
};

export type BotProtectionResult =
  | { ok: true }
  | { ok: false; code: "honeypot" | "turnstile_required" | "turnstile_failed"; message: string };

export function isTurnstileEnabled(): boolean {
  return Boolean(
    process.env.TURNSTILE_SECRET_KEY?.trim() &&
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim(),
  );
}

export function getTurnstileSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
}

function pruneDuplicates(now: number) {
  for (const [key, expires] of recentContactHashes) {
    if (expires <= now) recentContactHashes.delete(key);
  }
}

/** Returns true when this contact payload was seen recently (duplicate spam). */
export function isDuplicatePublicContact(args: {
  academySlug: string;
  email: string;
  message: string;
}): boolean {
  const now = Date.now();
  pruneDuplicates(now);
  const hash = createHash("sha256")
    .update(
      `${args.academySlug.trim().toLowerCase()}|${args.email.trim().toLowerCase()}|${args.message.trim().toLowerCase()}`,
    )
    .digest("hex");
  const existing = recentContactHashes.get(hash);
  if (existing && existing > now) return true;
  recentContactHashes.set(hash, now + DUPLICATE_TTL_MS);
  return false;
}

/**
 * Simple spam heuristics for public contact messages.
 * Fail closed only on clear spam patterns — not aggressive NLP.
 */
export function looksLikeSpamContact(args: {
  name: string;
  subject: string;
  message: string;
}): boolean {
  const blob = `${args.name}\n${args.subject}\n${args.message}`.toLowerCase();
  if ((blob.match(/https?:\/\//g) ?? []).length >= 3) return true;
  if (/viagra|crypto\s*invest|double your money|seo\s*backlink|\[url=/i.test(blob)) {
    return true;
  }
  if (args.message.length > 0 && args.message.replace(/\s/g, "").length < 8) {
    return true;
  }
  return false;
}

async function verifyTurnstileToken(
  token: string,
  request: Request,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return true;

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  const ip = getRequestIp(request);
  if (ip !== "unknown") form.set("remoteip", ip);

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: form,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    },
  );
  if (!response.ok) return false;
  const payload = (await response.json()) as { success?: boolean };
  return Boolean(payload.success);
}

export async function enforceBotProtection(args: {
  request: Request;
  input: BotProtectionInput;
  route: string;
  actorId?: string | null;
}): Promise<BotProtectionResult> {
  const honeypot = args.input.honeypot?.trim() ?? "";
  if (honeypot) {
    logAbuseEvent({
      event: "bot_blocked",
      route: args.route,
      actorId: args.actorId,
      ipHash: hashIp(getRequestIp(args.request)),
      detail: "honeypot_filled",
    });
    return {
      ok: false,
      code: "honeypot",
      message: "Unable to submit form.",
    };
  }

  if (isTurnstileEnabled()) {
    const token = args.input.turnstileToken?.trim() ?? "";
    if (!token) {
      logAbuseEvent({
        event: "turnstile_failed",
        route: args.route,
        actorId: args.actorId,
        ipHash: hashIp(getRequestIp(args.request)),
        detail: "missing_token",
      });
      return {
        ok: false,
        code: "turnstile_required",
        message: "Please complete the security check.",
      };
    }
    const ok = await verifyTurnstileToken(token, args.request);
    if (!ok) {
      logAbuseEvent({
        event: "turnstile_failed",
        route: args.route,
        actorId: args.actorId,
        ipHash: hashIp(getRequestIp(args.request)),
        detail: "verification_failed",
      });
      return {
        ok: false,
        code: "turnstile_failed",
        message: "Security check failed. Please try again.",
      };
    }
  }

  return { ok: true };
}
