"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

type AnimatedCounterProps = {
  value: number;
  className?: string;
  durationMs?: number;
  /** When false, renders the final value immediately. */
  animate?: boolean;
};

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function subscribeReducedMotion(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Subtle count-up for dashboard metrics — respects reduced motion. */
export function AnimatedCounter({
  value,
  className,
  durationMs = 650,
  animate = true,
}: AnimatedCounterProps) {
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => true,
  );
  const shouldAnimate = animate && !prefersReducedMotion;
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shouldAnimate) return;

    startRef.current = null;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / durationMs, 1);
      setDisplay(Math.round(easeOutCubic(progress) * value));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, durationMs, shouldAnimate]);

  const shown = shouldAnimate ? display : value;

  return (
    <span className={cn("tabular-nums", className)} aria-hidden>
      {shown}
    </span>
  );
}
