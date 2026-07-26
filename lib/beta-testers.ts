/**
 * Beta complimentary access is granted only via Auth `app_metadata`
 * (service-role / Dashboard admin). Never trust `user_metadata`.
 */
export const BETA_TESTER_APP_METADATA_KEY = "is_beta_tester";

export function isBetaTester(
  appMetadata: Record<string, unknown> | null | undefined,
): boolean {
  const raw = appMetadata?.[BETA_TESTER_APP_METADATA_KEY];
  return raw === true || raw === "true";
}
