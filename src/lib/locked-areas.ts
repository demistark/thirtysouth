export type SiteRole = "host" | "trip_guest" | "friend_afar" | "schedule_manager";

export function canViewScenes(roles: readonly SiteRole[]) {
  return roles.some((role) => role === "host" || role === "trip_guest" || role === "friend_afar");
}

export function nextFactIndex(length: number, current: number, random = Math.random()) {
  if (length < 2) return 0;
  const offset = 1 + Math.floor(Math.min(Math.max(random, 0), 0.999999) * (length - 1));
  return (current + offset) % length;
}

export const FACT_ROTATION_MS = 9000;
export function shouldRotateFacts(count: number, hidden: boolean, reducedMotion: boolean) {
  return count > 1 && !hidden && !reducedMotion;
}