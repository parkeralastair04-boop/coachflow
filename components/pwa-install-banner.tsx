"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Plus, Share2, Sparkles, X } from "lucide-react";
import { BrandAppIcon } from "@/components/brand-mark";

function isPublicBookingPath(pathname: string): boolean {
  if (pathname === "/book" || pathname.startsWith("/book/")) return true;
  return /^\/academy\/[^/]+\/book\/?$/.test(pathname);
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "awarix:pwa-install-dismissed";

function isStandaloneDisplayMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIosDevice() {
  const userAgent = window.navigator.userAgent;
  const touchMac =
    window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(userAgent) || touchMac;
}

export function PwaInstallBanner() {
  const pathname = usePathname();
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"prompt" | "ios">("prompt");

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
    const timeout = window.setTimeout(() => {
      if (window.localStorage.getItem(DISMISSED_KEY) === "true") return;
      if (isStandaloneDisplayMode()) return;
      if (!isIosDevice()) return;
      setMode("ios");
      setVisible(true);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      if (window.localStorage.getItem(DISMISSED_KEY) === "true") return;
      if (isStandaloneDisplayMode()) return;

      setMode("prompt");
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

  if (isPublicBookingPath(pathname)) return null;
  if (!visible) return null;
  if (mode === "prompt" && !promptEvent) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[60] sm:inset-x-auto sm:right-4 sm:max-w-md [padding-bottom:env(safe-area-inset-bottom)]">
      <div className="glass-panel rounded-[1.75rem] border border-white/10 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-5">
        <div className="flex items-start gap-4">
          <div className="size-14 shrink-0 overflow-hidden rounded-[28%] ring-1 ring-white/10">
            <BrandAppIcon />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="bg-accent/12 text-accent inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-accent/20">
                <Sparkles className="size-3" aria-hidden />
                Mobile app
              </span>
            </div>
            <p className="mt-3 text-base font-semibold tracking-tight">
              Add Awarix to Home Screen
            </p>
            <p className="text-muted mt-1 text-sm leading-relaxed">
              Launch faster, keep Awarix close at hand, and enjoy a cleaner app-like
              experience on mobile.
            </p>

            {mode === "ios" ? (
              <div className="mt-4 rounded-2xl bg-black/[0.02] p-3 text-sm dark:bg-white/[0.04]">
                <p className="font-medium">On iPhone or iPad</p>
                <p className="text-muted mt-1 leading-relaxed">
                  Tap <Share2 className="mx-1 inline size-3.5 align-[-1px]" aria-hidden /> Share,
                  then choose <Plus className="mx-1 inline size-3.5 align-[-1px]" aria-hidden />
                  Add to Home Screen.
                </p>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {mode === "prompt" ? (
                <button
                  type="button"
                  onClick={() => void handleInstall()}
                  className="bg-foreground text-background hover:opacity-90 inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity"
                >
                  <Download className="mr-2 size-4" aria-hidden />
                  Install Awarix
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleDismiss}
                className="border-border hover:bg-surface-hover inline-flex h-10 items-center justify-center rounded-full border px-5 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]"
              >
                Maybe later
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
