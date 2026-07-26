"use client";

import { HONEYPOT_FIELD_NAME } from "@/lib/bot-protection-shared";
import { readHoneypotFromForm } from "@/components/bot-protection-fields";

export async function runAuthPreflight(args: {
  form: HTMLFormElement;
  action: "login" | "signup" | "password_reset";
  turnstileToken?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const honeypot = readHoneypotFromForm(args.form);
  const response = await fetch("/api/auth/preflight", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: args.action,
      turnstileToken: args.turnstileToken || undefined,
      [HONEYPOT_FIELD_NAME]: honeypot,
    }),
  });

  if (response.status === 429) {
    return {
      ok: false,
      error: "Too many attempts. Please wait a few minutes and try again.",
    };
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    return {
      ok: false,
      error: payload.error ?? "Unable to continue right now. Please try again.",
    };
  }

  return { ok: true };
}
