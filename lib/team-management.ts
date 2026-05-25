import {
  PLAYER_POSITION_OPTIONS,
  type PlayerPositionOption,
  type PreferredFootOption,
} from "@/lib/player-profile";

export const TEAM_ROLE_OPTIONS = ["captain", "vice_captain"] as const;

export type TeamRole = (typeof TEAM_ROLE_OPTIONS)[number];
export type TeamSortOption = "squad_order" | "primary_position" | "name";
export type TeamViewMode = "roster" | "position";

export type TeamSummary = {
  id: string;
  team_name: string;
  age_group: string | null;
  team_color: string | null;
};

export type TeamPlayerProfile = {
  id: string;
  player_name: string;
  preferred_foot?: PreferredFootOption;
  primary_position: PlayerPositionOption | null;
  secondary_positions?: PlayerPositionOption[];
};

export type TeamPlayerMembership = {
  id: string;
  team_id: string;
  player_id: string;
  role: TeamRole | null;
  squad_order: number;
  created_at?: string;
  player: TeamPlayerProfile[] | TeamPlayerProfile | null;
  team?: TeamSummary[] | TeamSummary | null;
};

export type TeamRow = TeamSummary & {
  coach_id: string;
  academy_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  team_players: TeamPlayerMembership[] | null;
};

export const TEAM_COLOR_SWATCHES = [
  "#10B981",
  "#2563EB",
  "#0EA5E9",
  "#7C3AED",
  "#EC4899",
  "#F59E0B",
  "#334155",
] as const;

const POSITION_SORT_ORDER = new Map(
  PLAYER_POSITION_OPTIONS.map((position, index) => [position, index]),
);

export function unwrapSingleRelation<T>(value: T[] | T | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function isTeamRole(value: unknown): value is TeamRole {
  return typeof value === "string" && TEAM_ROLE_OPTIONS.includes(value as TeamRole);
}

export function normalizeTeamColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : null;
}

export function getTeamDisplayName(team: Pick<TeamSummary, "team_name" | "age_group">): string {
  if (team.age_group?.trim()) {
    return `${team.team_name} · ${team.age_group.trim()}`;
  }
  return team.team_name;
}

export function getTeamMembershipPlayer(
  membership: TeamPlayerMembership,
): TeamPlayerProfile | null {
  return unwrapSingleRelation(membership.player);
}

export function getPlayerTeams(
  memberships: Array<{ team?: TeamSummary[] | TeamSummary | null }> | null | undefined,
): TeamSummary[] {
  if (!memberships) return [];
  return memberships
    .map((membership) => unwrapSingleRelation(membership.team))
    .filter((team): team is TeamSummary => Boolean(team));
}

export function getRoleLabel(role: TeamRole | null): string {
  if (role === "captain") return "Captain";
  if (role === "vice_captain") return "Vice captain";
  return "Player";
}

function compareByName(a: TeamPlayerMembership, b: TeamPlayerMembership) {
  const playerA = getTeamMembershipPlayer(a)?.player_name ?? "";
  const playerB = getTeamMembershipPlayer(b)?.player_name ?? "";
  return playerA.localeCompare(playerB, "en-GB");
}

function compareByPosition(a: TeamPlayerMembership, b: TeamPlayerMembership) {
  const playerA = getTeamMembershipPlayer(a);
  const playerB = getTeamMembershipPlayer(b);
  const indexA = playerA?.primary_position
    ? (POSITION_SORT_ORDER.get(playerA.primary_position) ?? PLAYER_POSITION_OPTIONS.length)
    : PLAYER_POSITION_OPTIONS.length + 1;
  const indexB = playerB?.primary_position
    ? (POSITION_SORT_ORDER.get(playerB.primary_position) ?? PLAYER_POSITION_OPTIONS.length)
    : PLAYER_POSITION_OPTIONS.length + 1;
  return indexA - indexB || compareByName(a, b);
}

function compareBySquadOrder(a: TeamPlayerMembership, b: TeamPlayerMembership) {
  return a.squad_order - b.squad_order || compareByName(a, b);
}

export function sortTeamMemberships(
  memberships: TeamPlayerMembership[],
  sortBy: TeamSortOption,
): TeamPlayerMembership[] {
  const items = [...memberships];
  if (sortBy === "name") {
    return items.sort(compareByName);
  }
  if (sortBy === "primary_position") {
    return items.sort((a, b) => compareByPosition(a, b) || compareBySquadOrder(a, b));
  }
  return items.sort(compareBySquadOrder);
}

export function groupMembershipsByPosition(
  memberships: TeamPlayerMembership[],
  sortBy: TeamSortOption,
): Array<{ position: string; players: TeamPlayerMembership[] }> {
  const groups = new Map<string, TeamPlayerMembership[]>();
  for (const membership of memberships) {
    const position = getTeamMembershipPlayer(membership)?.primary_position ?? "Unassigned";
    const current = groups.get(position) ?? [];
    current.push(membership);
    groups.set(position, current);
  }

  return [...groups.entries()]
    .sort((a, b) => {
      const indexA =
        a[0] === "Unassigned"
          ? PLAYER_POSITION_OPTIONS.length + 1
          : (POSITION_SORT_ORDER.get(a[0] as PlayerPositionOption) ??
            PLAYER_POSITION_OPTIONS.length);
      const indexB =
        b[0] === "Unassigned"
          ? PLAYER_POSITION_OPTIONS.length + 1
          : (POSITION_SORT_ORDER.get(b[0] as PlayerPositionOption) ??
            PLAYER_POSITION_OPTIONS.length);
      return indexA - indexB || a[0].localeCompare(b[0], "en-GB");
    })
    .map(([position, players]) => ({
      position,
      players: sortTeamMemberships(players, sortBy === "primary_position" ? "squad_order" : sortBy),
    }));
}
