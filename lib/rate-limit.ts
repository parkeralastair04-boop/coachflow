import "server-only";

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { logAbuseEvent } from "@/lib/abuse-log";
import { incrementRateLimit } from "@/lib/rate-limit-store";

export type RateLimitConfig = {
  /** Unique bucket name, e.g. "academy_contact". */
  name: string;
  /** Max requests in the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export const RATE_LIMITS = {
  publicContact: { name: "public_contact", limit: 5, windowMs: 15 * 60_000 },
  publicBooking: { name: "public_booking", limit: 10, windowMs: 15 * 60_000 },
  publicBookingConfirm: {
    name: "public_booking_confirm",
    limit: 30,
    windowMs: 15 * 60_000,
  },
  publicReferral: { name: "public_referral", limit: 20, windowMs: 60 * 60_000 },
  authRelated: { name: "auth_related", limit: 20, windowMs: 15 * 60_000 },
  communicationSend: {
    name: "communication_send",
    limit: 10,
    windowMs: 60 * 60_000,
  },
  aiGenerate: { name: "ai_generate", limit: 20, windowMs: 60 * 60_000 },
  support: { name: "support", limit: 10, windowMs: 60 * 60_000 },
  billing: { name: "billing", limit: 15, windowMs: 15 * 60_000 },
  notifications: { name: "notifications", limit: 30, windowMs: 60 * 60_000 },
  familyWrite: { name: "family_write", limit: 40, windowMs: 15 * 60_000 },
  paymentsWrite: { name: "payments_write", limit: 20, windowMs: 15 * 60_000 },
  generalApi: { name: "general_api", limit: 120, windowMs: 15 * 60_000 },
} as const satisfies Record<string, RateLimitConfig>;

export function getRequestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export function getClientRateLimitKey(
  request: Request,
  config: RateLimitConfig,
  subject?: string | null,
): string {
  const ipHash = hashIp(getRequestIp(request));
  const subjectPart = subject?.trim() ? `:s:${subject.trim().toLowerCase()}` : "";
  return `${config.name}:${ipHash}${subjectPart}`;
}

/**
 * Fixed-window rate limiter.
 * Uses in-memory store by default; set UPSTASH_REDIS_REST_URL + TOKEN for shared limits.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const now = Date.now();
  const { count, resetAt } = await incrementRateLimit(key, config.windowMs);

  if (count > config.limit) {
    return {
      allowed: false,
      limit: config.limit,
      remaining: 0,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    };
  }

  return {
    allowed: true,
    limit: config.limit,
    remaining: Math.max(0, config.limit - count),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests. Please try again later.",
      code: "rate_limited",
      retryAfter: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}

export async function enforceRateLimit(args: {
  request: Request;
  config: RateLimitConfig;
  subject?: string | null;
  actorId?: string | null;
  route?: string;
}): Promise<NextResponse | null> {
  const key = getClientRateLimitKey(args.request, args.config, args.subject);
  const result = await checkRateLimit(key, args.config);
  if (result.allowed) return null;

  logAbuseEvent({
    event: "rate_limit",
    route: args.route ?? args.config.name,
    actorId: args.actorId,
    ipHash: hashIp(getRequestIp(args.request)),
    detail: `limit=${args.config.limit} windowMs=${args.config.windowMs}`,
  });

  return rateLimitResponse(result);
}
