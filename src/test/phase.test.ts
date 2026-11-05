import { describe, expect, it } from "vitest";
import { currentChapterFor, DEFAULT_SETTINGS as S, daysToGo, getPhase, heroSubKey } from "@/lib/phase";

// Boundaries are entered in Eastern (Etc/GMT+5, fixed UTC-5): Nov 20 00:00 Eastern
// is 2026-11-20T05:00:00Z; Nov 30 00:00 Eastern is 2026-11-30T05:00:00Z.
describe("one phase clock (Eastern boundaries)", () => {
  it("is before until Nov 20 00:00 Eastern", () => {
    expect(getPhase(new Date("2026-11-20T04:59:00Z"), S)).toBe("before");
  });
  it("is during from Nov 20 00:00 Eastern", () => {
    expect(getPhase(new Date("2026-11-20T05:00:00Z"), S)).toBe("during");
  });
  it("is still during at Nov 29 11:59 PM Eastern", () => {
    expect(getPhase(new Date("2026-11-30T04:59:00Z"), S)).toBe("during");
  });
  it("is after from Nov 30 00:00 Eastern", () => {
    expect(getPhase(new Date("2026-11-30T05:00:00Z"), S)).toBe("after");
  });
  it("a manual override wins over the dates", () => {
    expect(getPhase(new Date("2026-11-20T05:00:00Z"), { ...S, phase_override: "before" })).toBe("before");
    expect(getPhase(new Date("2026-11-01T12:00:00Z"), { ...S, phase_override: "after" })).toBe("after");
    expect(getPhase(new Date("2026-12-05T12:00:00Z"), { ...S, phase_override: "during" })).toBe("during");
  });
  it("honours a Cape Town phase timezone when selected", () => {
    const cpt = { ...S, phase_timezone: "Africa/Johannesburg" };
    expect(getPhase(new Date("2026-11-19T21:59:00Z"), cpt)).toBe("before");
    expect(getPhase(new Date("2026-11-19T22:00:00Z"), cpt)).toBe("during");
  });
});

describe("daysToGo", () => {
  it("reads 16 on Nov 4 and 1 on Nov 19 (Eastern dates)", () => {
    expect(daysToGo(new Date("2026-11-04T15:00:00Z"), S)).toBe(16);
    expect(daysToGo(new Date("2026-11-19T15:00:00Z"), S)).toBe(1);
  });
  it("never goes below 0", () => {
    expect(daysToGo(new Date("2026-11-25T12:00:00Z"), S)).toBe(0);
  });
});

describe("currentChapter fallback", () => {
  const chapters = [
    { number: 1, date: "2026-11-20" },
    { number: 9, date: "2026-11-28" },
    { number: 10, date: "2026-11-29" },
  ];
  it("picks the chapter whose date is Cape Town today", () => {
    expect(currentChapterFor(chapters, "2026-11-28")?.number).toBe(9);
  });
  it("falls back to the latest chapter on or before today (Cape Town Nov 30, 3 AM)", () => {
    // 2026-11-30T01:00:00Z is 03:00 in Cape Town, still During in Eastern.
    expect(currentChapterFor(chapters, "2026-11-30")?.number).toBe(10);
  });
  it("returns null before the first chapter", () => {
    expect(currentChapterFor(chapters, "2026-11-19")).toBeNull();
  });
});

describe("hero sub-line", () => {
  it("picks the far, near and final lines by days to go", () => {
    expect(heroSubKey(16)).toBe("home.hero.sub.far");
    expect(heroSubKey(8)).toBe("home.hero.sub.far");
    expect(heroSubKey(7)).toBe("home.hero.sub.near");
    expect(heroSubKey(3)).toBe("home.hero.sub.near");
    expect(heroSubKey(2)).toBe("home.hero.sub.final");
    expect(heroSubKey(1)).toBe("home.hero.sub.final");
  });
});
