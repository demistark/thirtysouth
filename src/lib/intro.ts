// Pure decision logic for the once-a-day opening animation on Home (During).
// The inline bootstrap in __root.tsx mirrors claimIntroDay; keep them in step.

export const INTRO_DAY_KEY = "30s-intro-day";

// The intro only exists during the trip; outside this window the bootstrap does nothing at all.
export const INTRO_WINDOW = { start: "2026-11-20", end: "2026-11-30" } as const;

/** True when a Cape Town day (YYYY-MM-DD) falls inside the intro window, boundaries included. */
export function inIntroWindow(day: string): boolean {
  return day >= INTRO_WINDOW.start && day <= INTRO_WINDOW.end;
}

/** Cape Town calendar date, YYYY-MM-DD. */
export function capeTownDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(d);
}

type MiniStorage = Pick<Storage, "getItem" | "setItem">;

/** Records today's visit; true only for the first page of the Cape Town day. False if storage fails. */
export function claimIntroDay(storage: MiniStorage | null | undefined, today: string): boolean {
  try {
    if (!storage) return false;
    if (storage.getItem(INTRO_DAY_KEY) === today) return false;
    storage.setItem(INTRO_DAY_KEY, today);
    return true;
  } catch {
    return false;
  }
}

export function shouldPlayIntro(o: { pathname: string; phase: string; firstOfDay: boolean; reducedMotion: boolean }): boolean {
  return o.pathname === "/" && o.phase === "during" && o.firstOfDay && !o.reducedMotion;
}

export interface PointerMark {
  x: number;
  y: number;
  t: number;
}

/** A clean tap: down and up within 10px and 600ms. */
export function isCleanTap(down: PointerMark | null, up: PointerMark): boolean {
  if (!down) return false;
  return Math.hypot(up.x - down.x, up.y - down.y) <= 10 && up.t - down.t <= 600 && up.t >= down.t;
}
