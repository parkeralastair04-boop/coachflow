/** Mirrors `public.slugify_text` in Postgres migrations. */
export function slugifyText(value: string | null | undefined): string {
  const slug = (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "coach";
}

export function buildCoachSlug(displayName: string, coachId: string): string {
  return `${slugifyText(displayName)}-${coachId.slice(0, 6)}`;
}

export function buildAcademySlug(name: string, academyId: string): string {
  return `${slugifyText(name) || "academy"}-${academyId.slice(0, 6)}`;
}
