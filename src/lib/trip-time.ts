// EST is deliberately fixed UTC-5, not daylight-saving Eastern time.
export const EST_ZONE = "Etc/GMT+5";
export const CPT_ZONE = "Africa/Johannesburg";
export type TripTimeZone = typeof EST_ZONE | typeof CPT_ZONE;

export function tripTimeZone(value: string): TripTimeZone {
  return value === EST_ZONE ? EST_ZONE : CPT_ZONE;
}

export function localTimeDate(value: string, zone: TripTimeZone): Date {
  const local = value.trim().replace(" ", "T");
  return new Date(`${local.length === 16 ? `${local}:00` : local}${zone === EST_ZONE ? "-05:00" : "+02:00"}`);
}

/** Convert a wall-clock input without relying on the browser's time zone. */
export function convertTripTime(value: string, from: TripTimeZone, to: TripTimeZone): string {
  if (!value) return "";
  const instant = localTimeDate(value, from);
  if (!Number.isFinite(instant.getTime())) return value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: to, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const get = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}