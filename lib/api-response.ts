import "server-only";

import { NextResponse } from "next/server";
import { logAbuseEvent } from "@/lib/abuse-log";
import { getRequestIp, hashIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { captureException } from "@/lib/monitoring";

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_failed"
  | "rate_limited"
  | "bot_blocked"
  | "ownership_denied"
  | "conflict"
  | "unavailable"
  | "internal_error";

const SAFE_DEFAULT = "Something went wrong. Please try again.";

export function apiError(
  status: number,
  message: string,
  code: ApiErrorCode,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code,
      ...extra,
    },
    { status },
  );
}

/** Log detailed error server-side; return a safe client message. */
export function safeApiError(args: {
  request?: Request;
  route: string;
  error: unknown;
  status?: number;
  clientMessage?: string;
  code?: ApiErrorCode;
  actorId?: string | null;
}): NextResponse {
  const detail =
    args.error instanceof Error
      ? args.error.message
      : typeof args.error === "string"
        ? args.error
        : "unknown";

  logger.error("app", `${args.route}: ${detail}`, {
    route: args.route,
    actorId: args.actorId ?? null,
  });
  void captureException(args.error, {
    route: args.route,
    tags: { source: "safeApiError" },
  });

  if (args.request) {
    logAbuseEvent({
      event: "validation_failed",
      route: args.route,
      actorId: args.actorId,
      ipHash: hashIp(getRequestIp(args.request)),
      detail: detail.slice(0, 200),
    });
  }

  return apiError(
    args.status ?? 500,
    args.clientMessage ?? SAFE_DEFAULT,
    args.code ?? "internal_error",
  );
}

export function validationError(
  message: string,
  request?: Request,
  route?: string,
): NextResponse {
  if (request && route) {
    logAbuseEvent({
      event: "validation_failed",
      route,
      ipHash: hashIp(getRequestIp(request)),
      detail: message.slice(0, 200),
    });
  }
  return apiError(400, message, "validation_failed");
}
