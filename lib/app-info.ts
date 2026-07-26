/**
 * Application identity for health checks, Sentry releases, and diagnostics.
 * Safe to import from client or server.
 */

import packageJson from "@/package.json";

export type AppRuntimeInfo = {
  name: string;
  version: string;
  buildTimestamp: string | null;
  environment: string;
  commitSha: string | null;
  release: string;
};

export function getAppRuntimeInfo(): AppRuntimeInfo {
  const version =
    process.env.NEXT_PUBLIC_APP_VERSION?.trim() ||
    packageJson.version ||
    "0.0.0";
  const buildTimestamp =
    process.env.NEXT_PUBLIC_BUILD_TIMESTAMP?.trim() || null;
  const commitSha =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.NEXT_PUBLIC_GIT_COMMIT_SHA?.trim() ||
    null;
  const environment =
    process.env.NEXT_PUBLIC_VERCEL_ENV?.trim() ||
    process.env.VERCEL_ENV?.trim() ||
    process.env.NODE_ENV ||
    "development";

  const release = commitSha
    ? `awarix@${version}+${commitSha.slice(0, 7)}`
    : `awarix@${version}`;

  return {
    name: "awarix",
    version,
    buildTimestamp,
    environment,
    commitSha,
    release,
  };
}
