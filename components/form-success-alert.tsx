"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { cn } from "@/lib/utils";

type FormSuccessAlertProps = {
  message: string;
  id?: string;
  className?: string;
  focusOnMount?: boolean;
};

export const FormSuccessAlert = forwardRef<HTMLDivElement, FormSuccessAlertProps>(
  function FormSuccessAlert(
    { message, id, className, focusOnMount = false },
    ref,
  ) {
    const localRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => localRef.current as HTMLDivElement);

    useEffect(() => {
      if (focusOnMount) localRef.current?.focus();
    }, [message, focusOnMount]);

    return (
      <div
        ref={localRef}
        id={id}
        role="status"
        aria-live="polite"
        tabIndex={-1}
        className={cn(
          "break-words rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200 dark:focus-visible:ring-emerald-500/50",
          className,
        )}
      >
        {message}
      </div>
    );
  },
);
