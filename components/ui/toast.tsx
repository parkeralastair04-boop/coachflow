"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "warning" | "error" | "info" | "loading";

type ToastItem = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
};

type ToastContextValue = {
  push: (toast: Omit<ToastItem, "id"> & { id?: string }) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClass: Record<ToastTone, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/80 dark:text-emerald-100",
  warning:
    "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/80 dark:text-amber-50",
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/80 dark:text-red-100",
  info: "border-border bg-card text-foreground",
  loading: "border-border bg-card text-foreground",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<ToastItem, "id"> & { id?: string }) => {
      const id = toast.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setItems((prev) => [...prev.slice(-4), { ...toast, id }]);
      if (toast.tone !== "loading") {
        window.setTimeout(() => dismiss(id), 4200);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role={item.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto motion-fade-in football-panel w-full max-w-sm rounded-2xl border px-4 py-3 shadow-lg",
              toneClass[item.tone],
            )}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold tracking-tight">{item.title}</p>
                {item.description ? (
                  <p className="mt-1 text-sm opacity-90">{item.description}</p>
                ) : null}
                {item.tone === "loading" ? (
                  <div className="mt-2 skeleton-pulse h-1.5 w-full rounded-full" />
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                className="hover:bg-black/5 dark:hover:bg-white/10 inline-flex size-8 items-center justify-center rounded-full"
                onClick={() => dismiss(item.id)}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

/** Safe toast helper when provider may be absent (no-op). */
export function useOptionalToast() {
  return useContext(ToastContext);
}
