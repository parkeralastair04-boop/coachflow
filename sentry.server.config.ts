import * as Sentry from "@sentry/nextjs";
import { getAppRuntimeInfo } from "@/lib/app-info";

const dsn =
  process.env.SENTRY_DSN?.trim() ||
  process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
  undefined;

const info = getAppRuntimeInfo();

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: info.environment,
  release: info.release,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  sendDefaultPii: false,
});
