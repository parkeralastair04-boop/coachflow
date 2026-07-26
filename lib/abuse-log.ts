import "server-only";

export type AbuseEventType =
  | "rate_limit"
  | "ownership_denied"
  | "validation_failed"
  | "bot_blocked"
  | "turnstile_failed"
  | "communication_blocked"
  | "suspicious_booking"
  | "ai_abuse"
  | "duplicate_request";

export type AbuseLogInput = {
  event: AbuseEventType;
  route?: string;
  actorId?: string | null;
  ipHash?: string | null;
  detail?: string;
  metadata?: Record<string, unknown>;
};

function redactMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!metadata) return {};
  const blocked = new Set([
    "password",
    "token",
    "secret",
    "authorization",
    "stripe",
    "apiKey",
    "api_key",
    "email",
    "phone",
    "parentEmail",
    "message",
    "body",
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (blocked.has(key) || /password|secret|token|email|phone/i.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string" && value.length > 200) {
      out[key] = `${value.slice(0, 200)}…`;
      continue;
    }
    out[key] = value;
  }
  return out;
}

/** Structured abuse/security logging. Never logs secrets or raw PII. */
export function logAbuseEvent(input: AbuseLogInput): void {
  const payload = {
    ts: new Date().toISOString(),
    event: input.event,
    route: input.route ?? null,
    actorId: input.actorId ?? null,
    ipHash: input.ipHash ?? null,
    detail: input.detail ?? null,
    metadata: redactMetadata(input.metadata),
  };
  console.warn("[awarix/abuse]", JSON.stringify(payload));
}
