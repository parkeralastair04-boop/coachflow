export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export function formatPortalDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(parsed);
}

export function formatPortalTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function formatParentReportDate(value: string | null): string {
  if (!value) return "No report yet";
  return formatPortalDate(value);
}

export function buildGoogleCalendarUrl(args: {
  title: string;
  startIso: string;
  durationMinutes: number;
  location?: string | null;
}): string {
  const start = new Date(args.startIso);
  if (Number.isNaN(start.getTime())) return "https://calendar.google.com";

  const end = new Date(start.getTime() + args.durationMinutes * 60 * 1000);
  const format = (date: Date) =>
    `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: args.title,
    dates: `${format(start)}/${format(end)}`,
    location: args.location?.trim() ?? "",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
