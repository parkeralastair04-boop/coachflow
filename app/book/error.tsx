"use client";

import { useEffect } from "react";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { captureClientException } from "@/lib/monitoring";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function BookingError({ error, reset }: ErrorProps) {
  useEffect(() => {
    captureClientException(error, {
      route: "book/error",
      tags: { digest: error.digest ?? "" },
    });
  }, [error]);

  return <AppErrorBoundary variant="booking" onRetry={reset} />;
}
