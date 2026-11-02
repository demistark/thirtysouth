import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS as S, daysToGo, getPhase } from "@/lib/phase";

// Johannesburg is UTC+2 year-round.
describe("trip phases (Africa/Johannesburg)", () => {
  it("uses EST midnight when selected instead of CPT midnight", () => {
    const est = { ...S, timezone: "Etc/GMT+5" };
    expect(getPhase(new Date("2026-11-20T04:59:00Z"), est)).toBe("before");
    expect(getPhase(new Date("2026-11-20T05:00:00Z"), est)).toBe("during");
    expect(getPhase(new Date("2026-11-20T04:59:00Z"), S)).toBe("during");
  });
  it("is before until midnight Nov 20 Johannesburg time", () => {
    expect(getPhase(new Date("2026-11-19T21:59:00Z"), S)).toBe("before");
  });
  it("is during from 00:00 Nov 20 Johannesburg time", () => {
    expect(getPhase(new Date("2026-11-19T22:00:00Z"), S)).toBe("during");
  });
  it("is still during on Nov 29", () => {
    expect(getPhase(new Date("2026-11-29T20:00:00Z"), S)).toBe("during");
  });
  it("is after from Nov 30 Johannesburg time", () => {
    expect(getPhase(new Date("2026-11-29T22:00:00Z"), S)).toBe("after");
  });
  it("counts days to go from trip_start", () => {
    expect(daysToGo(new Date("2026-10-27T10:00:00Z"), S)).toBe(24);
    expect(daysToGo(new Date("2026-11-19T10:00:00Z"), S)).toBe(1);
  });
});
