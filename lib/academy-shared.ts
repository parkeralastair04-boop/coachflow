export type AcademyRole = "owner" | "admin" | "coach" | "assistant";

export type AcademyBranding = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  custom_domain: string | null;
  support_email: string | null;
};

export const DEFAULT_ACADEMY_BRANDING: Omit<AcademyBranding, "id"> = {
  name: "CoachFlow",
  logo_url: null,
  primary_color: "#10B981",
  secondary_color: "#0F172A",
  custom_domain: null,
  support_email: null,
};
