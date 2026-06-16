/** Metadata key on `auth.users.raw_user_meta_data` for complimentary beta access. */
export const BETA_TESTER_METADATA_KEY = "is_beta_tester";

export function isBetaTester(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  const raw = metadata?.[BETA_TESTER_METADATA_KEY];
  return raw === true || raw === "true";
}
