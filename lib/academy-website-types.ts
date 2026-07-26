/**
 * Public-facing academy website types.
 * These contain only fields safe for unauthenticated visitors.
 * Never add parent, player, payment, attendance, or coach-only fields here.
 */

export type PublicAcademy = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  supportEmail: string | null;
  /** Present when phone publishing is enabled in product; otherwise null. */
  supportPhone: string | null;
  bookingEnabled: boolean;
  /** Optional public description for About/home. */
  description: string | null;
  /** Optional public address for the contact page. */
  address: string | null;
};

export type PublicTeam = {
  id: string;
  name: string;
  ageGroup: string | null;
  colour: string | null;
  displayName: string;
  /** Short public summary — never player or roster details. */
  summary: string;
};

export type PublicFixture = {
  id: string;
  teamId: string;
  teamName: string;
  opposition: string;
  competitionType: string;
  competitionName: string | null;
  venue: string | null;
  isHome: boolean;
  kickoffDate: string;
  kickoffTime: string | null;
  pitch: string | null;
  status: string;
  title: string;
};

export type PublicResult = {
  id: string;
  teamId: string;
  teamName: string;
  opposition: string;
  competitionType: string;
  competitionName: string | null;
  venue: string | null;
  isHome: boolean;
  kickoffDate: string;
  kickoffTime: string | null;
  status: string;
  title: string;
  homeScore: number | null;
  awayScore: number | null;
  scoreLabel: string | null;
};

export type PublicCamp = {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  ageGroup: string | null;
  price: number;
  location: string | null;
  dateLabel: string;
  /** Remaining spaces when capacity is known; null when unavailable. */
  remainingSpaces: number | null;
  /** Short public summary — never enrollee or parent details. */
  summary: string;
};

export type PublicCoach = {
  /** Public identifier (coach profile slug when available). */
  id: string;
  displayName: string;
  logoUrl: string | null;
  bookingEnabled: boolean;
  profileSlug: string | null;
  /** Public role label when available; null until content fields exist. */
  role: string | null;
  /** Short public biography when available; null until content fields exist. */
  biography: string | null;
};

export type PublicTraining = {
  id: string;
  title: string;
  ageGroup: string | null;
  theme: string | null;
  durationMinutes: number | null;
  difficulty: string | null;
  /** Public equipment summary — never coach-only kit notes. */
  equipmentSummary: string | null;
  /** Human-readable development focus labels. */
  developmentFocus: string[];
  /** Short public summary only — never coach notes or pitch data. */
  summary: string | null;
};

export type PublicVideo = {
  id: string;
  title: string;
  categoryLabel: string | null;
  /** Public summary — never AI output, coach notes, or parent comments. */
  summary: string | null;
  /** Optional public thumbnail URL when available. */
  thumbnailUrl: string | null;
  sourceUrl: string | null;
  durationSeconds: number | null;
  /** Human-readable development focus labels. */
  developmentFocus: string[];
  publishedAt: string;
};

export type PublicNewsArticle = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  coverImageUrl: string | null;
  publishedAt: string;
};

export type PublicAcademyContext = {
  slug: string;
  academy: PublicAcademy;
};
