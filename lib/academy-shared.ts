export type AcademyRole = "owner" | "admin" | "coach" | "assistant";

/** True once `academies.support_phone` exists in the database. */
export const ACADEMY_SUPPORT_PHONE_ENABLED = false;

export type AcademyBranding = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  custom_domain: string | null;
  support_email: string | null;
  support_phone?: string | null;
  public_description?: string | null;
  public_address?: string | null;
};

export const DEFAULT_ACADEMY_BRANDING: Omit<AcademyBranding, "id"> = {
  name: "Awarix",
  logo_url: null,
  primary_color: "#10B981",
  secondary_color: "#0F172A",
  custom_domain: null,
  support_email: null,
  public_description: null,
  public_address: null,
};
