import { describe, expect, it } from "vitest";
import { CPT_ZONE, EST_ZONE, convertTripTime, localTimeDate } from "@/lib/trip-time";

describe("EST and Cape Town trip-time input", () => {
  it("EST is UTC-5 even during summer", () => {
    expect(localTimeDate("2026-07-01T12:00", EST_ZONE).toISOString()).toBe("2026-07-01T17:00:00.000Z");
  });
  it("Cape Town is UTC+2", () => {
    expect(localTimeDate("2026-11-20T12:00", CPT_ZONE).toISOString()).toBe("2026-11-20T10:00:00.000Z");
  });
  it("converts EST entries to CPT storage across midnight", () => {
    expect(convertTripTime("2026-11-19T20:30", EST_ZONE, CPT_ZONE)).toBe("2026-11-20T03:30:00");
  });
  it("switching entry zones preserves the original instant and blank values", () => {
    const cpt = "2026-11-20T03:30:00";
    expect(convertTripTime(convertTripTime(cpt, CPT_ZONE, EST_ZONE), EST_ZONE, CPT_ZONE)).toBe(cpt);
    expect(convertTripTime("", EST_ZONE, CPT_ZONE)).toBe("");
  });
});