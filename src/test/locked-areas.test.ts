import { describe, expect, it } from "vitest";
import { canViewScenes, FACT_ROTATION_MS, nextFactIndex, shouldRotateFacts } from "@/lib/locked-areas";
import { parseFactsCsv } from "@/lib/facts";

describe("locked area access", () => {
  it("allows trip guests to Scenes and Wardrobe", () => expect(canViewScenes(["trip_guest"])).toBe(true));
  it("allows hosts to Scenes and Wardrobe", () => expect(canViewScenes(["host"])).toBe(true));
  it("allows friends afar to Scenes and Wardrobe", () => expect(canViewScenes(["friend_afar"])).toBe(true));
  it("does not grant access without an allowed role", () => { expect(canViewScenes([])).toBe(false); expect(canViewScenes(["schedule_manager"])).toBe(false); });
});
describe("travel fact rotation", () => {
  it("rotates every nine seconds", () => expect(FACT_ROTATION_MS).toBe(9000));
  it("chooses a different fact", () => { expect(nextFactIndex(3, 1, 0)).toBe(2); expect(nextFactIndex(3, 1, 0.99)).toBe(0); });
  it("pauses when the tab is hidden", () => expect(shouldRotateFacts(2, true, false)).toBe(false));
  it("does not rotate with reduced motion", () => expect(shouldRotateFacts(2, false, true)).toBe(false));
  it("rotates only when there are multiple facts", () => { expect(shouldRotateFacts(2, false, false)).toBe(true); expect(shouldRotateFacts(1, false, false)).toBe(false); });
});
describe("facts CSV", () => {
  it("imports text and active, including quoted commas and newlines", () => expect(parseFactsCsv('text,active\n"A fact, with a comma",true\n"Two\nlines",false')).toEqual([{ text: "A fact, with a comma", active: true }, { text: "Two\nlines", active: false }]));
  it("defaults a blank active field to true", () => expect(parseFactsCsv("text,active\nFact,"))[0]?.active).toBe(true));
  it("rejects invalid active values and empty text before importing", () => { expect(() => parseFactsCsv("text,active\nFact,maybe")).toThrow(); expect(() => parseFactsCsv("text,active\n,true")).toThrow(); });
});