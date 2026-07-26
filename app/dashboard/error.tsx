"use client";

import { useEffect } from "react";
import { SetupRequiredPanel } from "@/components/setup-required-panel";
import {
  DASHBOARD_ERROR_DESCRIPTION,
  DASHBOARD_ERROR_TITLE,
} from "@/lib/error-experience";
import { captureClientException } from "@/lib/monitoring";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    captureClientException(error, {
      route: "dashboard/error",
      tags: { digest: error.digest ?? "" },
    });
  }, [error]);

  return (
    <SetupRequiredPanel
      alert
      title={DASHBOARD_ERROR_TITLE}
      description={DASHBOARD_ERROR_DESCRIPTION}
      onRetry={reset}
    />
  );
}
