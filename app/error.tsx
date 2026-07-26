"use client";

import { useEffect } from "react";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { captureClientException } from "@/lib/monitoring";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    captureClientException(error, {
      route: "app/error",
      tags: { digest: error.digest ?? "none" },
    });
  }, [error]);

  return <AppErrorBoundary variant="global" onRetry={reset} />;
}
