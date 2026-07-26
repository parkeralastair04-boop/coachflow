"use client";

import { useEffect } from "react";
import { AppErrorBoundary } from "@/components/app-error-boundary";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AcademyBookingError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <AppErrorBoundary variant="booking" onRetry={reset} />;
}
