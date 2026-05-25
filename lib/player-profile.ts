export const PREFERRED_FOOT_OPTIONS = [
  "Left",
  "Right",
  "Both",
  "Unknown",
] as const;

export type PreferredFootOption = (typeof PREFERRED_FOOT_OPTIONS)[number];

export const PLAYER_POSITION_OPTIONS = [
  "GK",
  "RB",
  "RWB",
  "CB",
  "LB",
  "LWB",
  "CDM",
  "CM",
  "CAM",
  "RM",
  "LM",
  "RW",
  "LW",
  "CF",
  "ST",
] as const;

export type PlayerPositionOption = (typeof PLAYER_POSITION_OPTIONS)[number];

export type PlayerFootballProfile = {
  preferred_foot: PreferredFootOption;
  primary_position: PlayerPositionOption | null;
  secondary_positions: PlayerPositionOption[];
};

export function isPreferredFootOption(value: unknown): value is PreferredFootOption {
  return (
    typeof value === "string" &&
    PREFERRED_FOOT_OPTIONS.includes(value as PreferredFootOption)
  );
}

export function isPlayerPositionOption(value: unknown): value is PlayerPositionOption {
  return (
    typeof value === "string" &&
    PLAYER_POSITION_OPTIONS.includes(value as PlayerPositionOption)
  );
}

export function normalizeSecondaryPositions(
  value: unknown,
): PlayerPositionOption[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlayerPositionOption);
}

export function getPositionSummary(profile: {
  primary_position: PlayerPositionOption | null;
  secondary_positions: PlayerPositionOption[];
}): string {
  const secondary = profile.secondary_positions.filter(
    (position) => position !== profile.primary_position,
  );
  if (profile.primary_position && secondary.length > 0) {
    return `${profile.primary_position} · ${secondary.join(", ")}`;
  }
  if (profile.primary_position) return profile.primary_position;
  if (secondary.length > 0) return secondary.join(", ");
  return "Not set";
}

export function getPlayerProfileSummary(profile: {
  preferred_foot: PreferredFootOption;
  primary_position: PlayerPositionOption | null;
  secondary_positions: PlayerPositionOption[];
}): string {
  const positionSummary = getPositionSummary(profile);
  if (positionSummary === "Not set") {
    return `${profile.preferred_foot} foot`;
  }
  return `${positionSummary} · ${profile.preferred_foot} foot`;
}
