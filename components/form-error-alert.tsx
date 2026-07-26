"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { cn } from "@/lib/utils";

type FormErrorAlertProps = {
  message: string;
  id?: string;
  className?: string;
  focusOnMount?: boolean;
};

export const FormErrorAlert = forwardRef<HTMLDivElement, FormErrorAlertProps>(
  function FormErrorAlert({ message, id, className, focusOnMount = true }, ref) {
    const localRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => localRef.current as HTMLDivElement);

    useEffect(() => {
      if (focusOnMount) {
        localRef.current?.focus();
      }
    }, [message, focusOnMount]);

    return (
      <div
        ref={localRef}
        id={id}
        role="alert"
        aria-live="assertive"
        tabIndex={-1}
        className={cn(
          "break-words rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 dark:focus-visible:ring-red-500/50",
          className,
        )}
      >
        {message}
      </div>
    );
  },
);
