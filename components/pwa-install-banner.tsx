"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "coachflow:pwa-install-dismissed";

function isStandaloneDisplayMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function PwaInstallBanner() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function registerServiceWorker() {
      void navigator.serviceWorker.register("/sw.js");
    }

    if (document.readyState === "complete") {
      registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker);
    return () => {
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      if (window.localStorage.getItem(DISMISSED_KEY) === "true") return;
      if (isStandaloneDisplayMode()) return;

      setPromptEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    }

    function handleAppInstalled() {
      setVisible(false);
      setPromptEvent(null);
      window.localStorage.setItem(DISMISSED_KEY, "true");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      window.localStorage.setItem(DISMISSED_KEY, "true");
    }
    setVisible(false);
    setPromptEvent(null);
  }

  function handleDismiss() {
    window.localStorage.setItem(DISMISSED_KEY, "true");
    setVisible(false);
  }

  if (!visible || !promptEvent) return null;

  return (
    <div className="fixed right-4 bottom-4 z-[60] max-w-sm">
      <div className="glass-panel rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="bg-accent/10 ring-accent/25 flex size-10 shrink-0 items-center justify-center rounded-xl ring-1">
            <Download className="text-accent size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-tight">
              Install CoachFlow
            </p>
            <p className="text-muted mt-1 text-xs leading-relaxed">
              Add CoachFlow to your device for quick access and offline-ready
              dashboard pages.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void handleInstall()}
                className="bg-foreground text-background hover:opacity-90 inline-flex h-9 items-center justify-center rounded-full px-4 text-xs font-medium transition-opacity"
              >
                Install
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="border-border hover:bg-black/[0.03] inline-flex h-9 items-center justify-center rounded-full border px-4 text-xs font-medium transition-colors dark:hover:bg-white/[0.06]"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="text-muted hover:text-foreground rounded-lg p-1 transition-colors"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
