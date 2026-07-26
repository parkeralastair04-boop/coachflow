"use client";

import {
  useEffect,
  useId,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

export type DialogSize = "sm" | "md" | "lg" | "xl";

const sizeClass: Record<DialogSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  className?: string;
};

/**
 * Accessible modal dialog — consistent sizing and reduced-motion friendly.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function getFocusable(): HTMLElement[] {
      if (!panelRef.current) return [];
      return [
        ...panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ];
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panelRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="motion-fade-in absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "football-panel motion-fade-in relative z-10 w-full rounded-2xl p-5 shadow-xl outline-none sm:p-6",
          sizeClass[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 id={titleId} className={TYPE.sectionTitle}>
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className={TYPE.description}>
                {description}
              </p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            shape="soft"
            aria-label="Close"
            onClick={onClose}
            className="size-10 min-h-10 min-w-10"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
        <div className="mt-5">{children}</div>
        {footer ? (
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <span className="sr-only">Confirmation required</span>
    </Dialog>
  );
}

export function AlertBanner({
  tone = "info",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: "info" | "success" | "warning" | "error";
}) {
  const tones = {
    info: "border-border bg-surface-subtle text-foreground",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200",
    warning:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
    error:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300",
  } as const;

  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border px-4 py-3 text-sm leading-relaxed",
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
