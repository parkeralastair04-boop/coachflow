"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { DEMO_COOKIE, DEMO_TOUR_STORAGE_KEY } from "@/lib/demo/constants";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

function subscribeDemoCookie(onStoreChange: () => void) {
  window.addEventListener("focus", onStoreChange);
  return () => window.removeEventListener("focus", onStoreChange);
}

function getDemoCookieSnapshot() {
  return readCookie(DEMO_COOKIE) === "1";
}

function getDemoCookieServerSnapshot() {
  return false;
}

export function DemoModeBanner({ className }: { className?: string }) {
  const active = useSyncExternalStore(
    subscribeDemoCookie,
    getDemoCookieSnapshot,
    getDemoCookieServerSnapshot,
  );

  if (!active) return null;

  return (
    <div
      className={cn(
        "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-50 border-b px-4 py-2.5 text-center text-sm",
        className,
      )}
      role="status"
    >
      <strong className="font-semibold">Demo mode</strong>
      {" — "}
      Sample Riverside United data. No emails, payments, or production records.
      {" "}
      <Link href="/demo" className="font-medium underline underline-offset-2">
        Demo hub
      </Link>
    </div>
  );
}

export function enterDemoMode() {
  document.cookie = `${DEMO_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
  try {
    localStorage.removeItem(DEMO_TOUR_STORAGE_KEY);
    localStorage.removeItem("awarix.demo.mutations");
  } catch {
    // ignore
  }
}

export function exitDemoMode() {
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function resetDemoExperience() {
  enterDemoMode();
  try {
    localStorage.removeItem(DEMO_TOUR_STORAGE_KEY);
    localStorage.removeItem("awarix.demo.mutations");
  } catch {
    // ignore
  }
}

export function DemoEnterButton({
  href = "/demo/dashboard",
  label = "Enter live academy",
  className,
}: {
  href?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: "primary" }), className)}
      onClick={() => enterDemoMode()}
    >
      {label}
    </Link>
  );
}

export function DemoResetButton() {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => {
        resetDemoExperience();
        window.location.href = "/demo/dashboard";
      }}
    >
      Reset demo
    </Button>
  );
}
