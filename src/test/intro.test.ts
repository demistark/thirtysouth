import { describe, expect, it } from "vitest";
import { capeTownDay, claimIntroDay, inIntroWindow, INTRO_DAY_KEY, INTRO_WINDOW, isCleanTap, shouldPlayIntro } from "@/lib/intro";

function mem() {
  const m = new Map<string, string>();
  let writes = 0;
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      writes++;
      m.set(k, v);
    },
    get writes() {
      return writes;
    },
  };
}

describe("intro decision", () => {
  const base = { pathname: "/", phase: "during", firstOfDay: true, reducedMotion: false };
  it("plays only on Home, during, first page of day, no reduced motion", () => {
    expect(shouldPlayIntro(base)).toBe(true);
    expect(shouldPlayIntro({ ...base, pathname: "/travel" })).toBe(false);
    expect(shouldPlayIntro({ ...base, phase: "before" })).toBe(false);
    expect(shouldPlayIntro({ ...base, phase: "after" })).toBe(false);
    expect(shouldPlayIntro({ ...base, firstOfDay: false })).toBe(false);
    expect(shouldPlayIntro({ ...base, reducedMotion: true })).toBe(false);
  });

  it("sets the day flag once per Cape Town day", () => {
    const s = mem();
    expect(claimIntroDay(s, "2026-11-24")).toBe(true);
    expect(s.getItem(INTRO_DAY_KEY)).toBe("2026-11-24");
    expect(claimIntroDay(s, "2026-11-24")).toBe(false);
    expect(s.writes).toBe(1);
    expect(claimIntroDay(s, "2026-11-25")).toBe(true);
  });

  it("does not play when storage is unavailable", () => {
    const broken = { getItem: () => { throw new Error("no"); }, setItem: () => {} };
    expect(claimIntroDay(broken, "2026-11-24")).toBe(false);
    expect(claimIntroDay(null, "2026-11-24")).toBe(false);
  });

  it("the intro window covers only the trip, boundaries included", () => {
    expect(INTRO_WINDOW).toEqual({ start: "2026-11-20", end: "2026-11-30" });
    expect(inIntroWindow("2026-11-19")).toBe(false);
    expect(inIntroWindow("2026-11-20")).toBe(true);
    expect(inIntroWindow("2026-11-24")).toBe(true);
    expect(inIntroWindow("2026-11-30")).toBe(true);
    expect(inIntroWindow("2026-12-01")).toBe(false);
    expect(inIntroWindow("2026-11-06")).toBe(false);
  });

  it("uses the Cape Town date", () => {
    // 23:30 UTC on Nov 23 is 01:30 on Nov 24 in Cape Town.
    expect(capeTownDay(new Date("2026-11-23T23:30:00Z"))).toBe("2026-11-24");
  });

  it("a clean tap skips; a swipe or long press does not", () => {
    const down = { x: 100, y: 100, t: 0 };
    expect(isCleanTap(down, { x: 105, y: 104, t: 200 })).toBe(true);
    expect(isCleanTap(down, { x: 140, y: 100, t: 200 })).toBe(false);
    expect(isCleanTap(down, { x: 100, y: 100, t: 900 })).toBe(false);
    expect(isCleanTap(null, { x: 100, y: 100, t: 10 })).toBe(false);
  });
});
