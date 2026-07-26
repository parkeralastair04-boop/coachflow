"use client";

import { useEffect } from "react";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { captureClientException } from "@/lib/monitoring";
import "./globals.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    captureClientException(error, {
      route: "app/global-error",
      tags: { digest: error.digest ?? "none" },
    });
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <AppErrorBoundary variant="global" onRetry={reset} />
      </body>
    </html>
  );
}
