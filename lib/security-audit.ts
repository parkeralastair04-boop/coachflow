import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type SecurityAuditActorType =
  | "user"
  | "webhook"
  | "cron"
  | "admin_api"
  | "system"
  | "migration";

export type SecurityAuditOutcome = "success" | "failure" | "denied";

export type SecurityAuditInput = {
  actorType: SecurityAuditActorType;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome: SecurityAuditOutcome;
  metadata?: Record<string, unknown>;
  requestId?: string | null;
};

export async function auditLog(input: SecurityAuditInput): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("security_audit_log").insert({
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId ?? null,
      outcome: input.outcome,
      metadata: input.metadata ?? {},
      request_id: input.requestId ?? null,
    });

    if (error) {
      console.error(
        "[awarix/security-audit] Failed to write audit log:",
        error.message,
      );
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown audit logging error.";
    console.error("[awarix/security-audit] Failed to write audit log:", message);
  }
}
