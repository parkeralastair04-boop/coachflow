export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    const { runStartupValidation } = await import("./lib/env/validate-startup");
    runStartupValidation();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(
  ...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>
) {
  const Sentry = await import("@sentry/nextjs");
  return Sentry.captureRequestError(...args);
}
