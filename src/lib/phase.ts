// One phase clock for the whole site. Boundaries are entered in the phase
// time zone (Eastern by default); everything the site displays stays in Cape
// Town time (the `timezone` setting).

export type Phase = "before" | "during" | "after";

export interface TripSettings {
  /** "YYYY-MM-DD HH:mm" in phase_timezone — During begins here. */
  phase_during_start: string;
  /** "YYYY-MM-DD HH:mm" in phase_timezone — After begins here (During ends). */
  phase_after_start: string;
  /** Zone the boundaries are entered in (Etc/GMT+5 = Eastern, or Africa/Johannesburg). */
  phase_timezone: string;
  /** auto | before | during | after — a manual override wins over the dates. */
  phase_override: string;
  /** Display zone (Cape Town). */
  timezone: string;
}

export const DEFAULT_SETTINGS: TripSettings = {
  phase_during_start: "2026-11-20 00:00",
  phase_after_start: "2026-11-30 00:00",
  phase_timezone: "Etc/GMT+5",
  phase_override: "auto",
  timezone: "Africa/Johannesburg",
};

/** Calendar date (YYYY-MM-DD) of `now` in the given time zone. */
export function zonedDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Wall-clock stamp "YYYY-MM-DD HH:mm" of `now` in the given time zone. */
export function zonedStamp(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export function getPhase(now: Date, s: TripSettings): Phase {
  const o = s.phase_override;
  if (o === "before" || o === "during" || o === "after") return o;
  const stamp = zonedStamp(now, s.phase_timezone);
  if (stamp < s.phase_during_start) return "before";
  if (stamp >= s.phase_after_start) return "after";
  return "during";
}

function dayNumber(d: string): number {
  const [y = 0, m = 1, day = 1] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day) / 86_400_000;
}

/** Whole calendar days from today to the During start date, both in the phase zone. */
export function daysToGo(now: Date, s: TripSettings): number {
  const startDate = s.phase_during_start.slice(0, 10);
  return Math.max(0, dayNumber(startDate) - dayNumber(zonedDate(now, s.phase_timezone)));
}

/** Chapter for a Cape Town date: exact match, else the latest chapter on or before it. */
export function currentChapterFor<T extends { date: string }>(chapters: T[], today: string): T | null {
  const exact = chapters.find((c) => c.date === today);
  if (exact) return exact;
  const past = chapters.filter((c) => c.date <= today);
  if (!past.length) return null;
  return past.reduce((a, b) => (b.date > a.date ? b : a));
}

/** Key for the small line under "days to go" on the Before Home hero card. */
export function heroSubKey(days: number): "home.hero.sub.far" | "home.hero.sub.near" | "home.hero.sub.final" {
  if (days > 7) return "home.hero.sub.far";
  if (days >= 3) return "home.hero.sub.near";
  return "home.hero.sub.final";
}

export function formatPreviewLabel(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  })
    .format(now)
    .replace(",", "");
}
