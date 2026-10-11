// Display helpers. All dates are shown in India time.
const TZ = "Asia/Kolkata";

export const DEAL_STAGE_LABELS: Record<string, string> = {
  outreach: "Outreach",
  in_conversation: "In conversation",
  pilot: "Pilot",
  customer_expansion: "Customer expansion",
};

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: TZ }).format(new Date(value));
}

export function formatDateLong(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: TZ }).format(new Date(value));
}

// "Thursday 8:04 AM"
export function formatRunTime(value: string): string {
  const d = new Date(value);
  const day = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: TZ }).format(d);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ }).format(d).toUpperCase();
  return `${day}, ${time}`;
}

export function daysAgo(value: string | null | undefined, now = new Date()): number | null {
  if (!value) return null;
  return Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000);
}

export function formatScore(score: number | string): string {
  const n = Number(score);
  return n === 0 ? "0" : n.toFixed(1);
}

export function hostname(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Google News sometimes gives a URL instead of a publication name.
export function sourceLabel(name: string | null | undefined, url?: string | null): string {
  if (name && !/^https?:\/\//i.test(name)) return name;
  return hostname(name) || hostname(url) || "Source";
}
