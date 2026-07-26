"use client";

import { useEffect, useId, useState } from "react";
import { HONEYPOT_FIELD_NAME } from "@/lib/bot-protection-shared";

type BotProtectionFieldsProps = {
  onTurnstileToken?: (token: string) => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
        },
      ) => string;
      remove?: (widgetId: string) => void;
    };
  }
}

/**
 * Honeypot + optional Cloudflare Turnstile widget for public forms.
 * Turnstile only loads when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
 */
export function BotProtectionFields({ onTurnstileToken }: BotProtectionFieldsProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";
  const reactId = useId().replace(/:/g, "");
  const slotId = `cf-turnstile-slot-${reactId}`;
  const honeypotId = `${HONEYPOT_FIELD_NAME}-${reactId}`;
  const [widgetReady, setWidgetReady] = useState(false);

  useEffect(() => {
    if (!siteKey || !onTurnstileToken) return;

    let cancelled = false;
    let widgetId: string | null = null;

    function mount() {
      const el = document.getElementById(slotId);
      if (!el || !window.turnstile || cancelled) return;
      widgetId = window.turnstile.render(el, {
        sitekey: siteKey,
        callback: (token) => onTurnstileToken?.(token),
        "error-callback": () => onTurnstileToken?.(""),
        "expired-callback": () => onTurnstileToken?.(""),
      });
      setWidgetReady(true);
    }

    const existing = document.querySelector(
      'script[data-awarix-turnstile="1"]',
    );
    if (existing) {
      mount();
      return () => {
        cancelled = true;
        if (widgetId && window.turnstile?.remove) window.turnstile.remove(widgetId);
      };
    }

    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.awarixTurnstile = "1";
    script.onload = () => mount();
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile?.remove) window.turnstile.remove(widgetId);
    };
  }, [siteKey, onTurnstileToken, slotId]);

  return (
    <>
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden"
      >
        <label htmlFor={honeypotId}>Company website</label>
        <input
          id={honeypotId}
          name={HONEYPOT_FIELD_NAME}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>
      {siteKey ? (
        <div className="mt-2">
          <div id={slotId} />
          {!widgetReady ? (
            <p className="text-muted text-xs">Loading security check…</p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function readHoneypotFromForm(form: HTMLFormElement): string {
  const field = form.elements.namedItem(HONEYPOT_FIELD_NAME);
  if (field && "value" in field && typeof field.value === "string") {
    return field.value;
  }
  return "";
}
