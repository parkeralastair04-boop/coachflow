/** Safe internal redirect target after login / auth. Edge-safe (no server-only). */
export function getSafeAuthNextPath(
  raw: string | null | undefined,
  fallback = "/dashboard",
): string {
  const value = raw?.trim() ?? "";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return fallback;
  }
  return value;
}
