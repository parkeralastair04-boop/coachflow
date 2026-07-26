export type AcademyNewsRow = {
  id: string;
  academy_id: string;
  coach_id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  cover_image_url: string | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Build a URL-safe slug from a title. */
export function slugifyNewsTitle(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "article";
}

export function formatNewsPublishedDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}
