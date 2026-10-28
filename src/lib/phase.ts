export type Phase = "before" | "during" | "after";

export interface TripSettings {
  trip_start: string; // YYYY-MM-DD
  trip_end: string;
  after_trip_start: string;
  timezone: string;
}

export const DEFAULT_SETTINGS: TripSettings = {
  trip_start: "2026-11-20",
  trip_end: "2026-11-29",
  after_trip_start: "2026-11-30",
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

export function getPhase(now: Date, s: TripSettings): Phase {
  const today = zonedDate(now, s.timezone);
  if (today < s.trip_start) return "before";
  if (today < s.after_trip_start) return "during";
  return "after";
}

function dayNumber(d: string): number {
  const [y = 0, m = 1, day = 1] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day) / 86_400_000;
}

export function daysToGo(now: Date, s: TripSettings): number {
  return Math.max(0, dayNumber(s.trip_start) - dayNumber(zonedDate(now, s.timezone)));
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
