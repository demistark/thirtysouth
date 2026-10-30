import { describe, expect, it } from "vitest";
import { canViewScenes } from "@/lib/locked-areas";
import { CSV_MAX_ROWS, TIME_RE, canEditItinerary, exportChaptersCsv, initialItineraryView, parseChaptersCsv, parsePalette, parseScenesCsv, parseWardrobeCsv, type Chapter, type Scene } from "@/lib/itinerary";

const ch = (n: number, date: string): Chapter => ({ number: n, date, title: `T${n}`, summary: "S", visible: true, sort_order: n });
const chapters = [ch(1, "2026-11-20"), ch(2, "2026-11-21")];

describe("itinerary access", () => {
  it("lets friend_afar read but not write", () => { expect(canViewScenes(["friend_afar"])).toBe(true); expect(canEditItinerary(["friend_afar"])).toBe(false); });
  it("lets host and schedule_manager write", () => { expect(canEditItinerary(["host"])).toBe(true); expect(canEditItinerary(["schedule_manager"])).toBe(true); expect(canEditItinerary(["trip_guest"])).toBe(false); });
});

describe("opening tab", () => {
  it("opens Scenes on today's chapter for allowed viewers", () => expect(initialItineraryView(true, "2026-11-21", chapters)).toEqual({ tab: "scenes", chapter: 2 }));
  it("opens Script when no chapter matches today", () => expect(initialItineraryView(true, "2026-10-01", chapters).tab).toBe("script"));
  it("opens Script for blocked viewers even on a chapter day", () => expect(initialItineraryView(false, "2026-11-21", chapters).tab).toBe("script"));
});

describe("times", () => {
  it("accepts 12-hour times", () => { expect(TIME_RE.test("9:30 AM")).toBe(true); expect(TIME_RE.test("12:05 PM")).toBe(true); });
  it("rejects 24-hour and malformed times", () => { expect(TIME_RE.test("21:30")).toBe(false); expect(TIME_RE.test("09:30 AM")).toBe(false); expect(TIME_RE.test("9:30am")).toBe(false); });
});

describe("CSV import", () => {
  it("round-trips the five Script fields", () => {
    const chapter: Chapter = { ...ch(5, "2026-11-24"), layout: "right", heading_before: "EXT: VILLA TERRACE - MORNING", heading_before_align: "center", transition_after: "FADE TO BLACK", transition_after_align: "right" };
    expect(parseChaptersCsv(exportChaptersCsv([chapter]), []).rows[0]).toEqual(chapter);
  });
  it("blank Script cells preserve existing values", () => {
    const chapter: Chapter = { ...ch(8, "2026-11-27"), layout: "center", heading_before: "EXT: TERRACE", heading_before_align: "right", transition_after: "JUMP CUT TO:", transition_after_align: "left" };
    expect(parseChaptersCsv("chapter,date,title,summary,layout,heading_before,heading_before_align,transition_after,transition_after_align\n8,,,,,,,,", [chapter]).rows[0]).toEqual(chapter);
  });
  it("rejects alignment outside left, center and right", () => {
    expect(parseChaptersCsv("chapter,date,title,summary,layout\n1,2026-11-20,Title,,justify", []).rows).toEqual([]);
  });
  it("keeps legacy chapter CSV compatible and defaults new alignments", () => {
    expect(parseChaptersCsv("chapter,date,title,summary\n1,2026-11-20,Title,", []).rows[0]).toMatchObject({ layout: "left", heading_before_align: "center", transition_after_align: "right" });
  });
  it("parses quoted multi-line details with commas and emoji", () => {
    const r = parseScenesCsv('chapter,scene_order,title,location,kind,leave_at,start,end,summary,details,experience_card,wardrobe_look\n1,1,Hike,"Table Mountain, Cape Town",flex,,7:00 AM,1:00 AM,,"Bring water, hat 🧢\nSunscreen",,2', [], [1, 2]);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ location: "Table Mountain, Cape Town", details: "Bring water, hat 🧢\nSunscreen", kind: "flex", end_time: "1:00 AM", wardrobe_look: 2 });
  });
  it("imports nothing when any row is invalid", () => {
    const r = parseScenesCsv("chapter,scene_order,title,location,kind,leave_at,start,end,summary,details,experience_card,wardrobe_look\n1,1,Good,,core,,,,,,,\n1,2,Bad,,core,,25:00,,,,,", [], [1]);
    expect(r.rows).toEqual([]); expect(r.errors[0]?.row).toBe(3);
  });
  it("keeps existing values for blank cells", () => {
    const old: Scene = { id: "x", chapter_number: 1, scene_order: 1, title: "Old", location: "Here", kind: "optional", leave_at: "8:00 AM", start_time: null, end_time: null, summary: "keep", details: "d", experience_card: null, wardrobe_look: 1, visible: false };
    const r = parseScenesCsv("chapter,scene_order,title,location,kind,leave_at,start,end,summary,details,experience_card,wardrobe_look\n1,1,New,,,,,,,,,", [old], [1]);
    expect(r.rows[0]).toMatchObject({ title: "New", location: "Here", kind: "optional", leave_at: "8:00 AM", summary: "keep", wardrobe_look: 1, visible: false });
  });
  it("rejects chapters outside 1 to 10 and bad dates", () => {
    expect(parseChaptersCsv("chapter,date,title,summary\n11,2026-11-20,X,", []).errors.length).toBe(1);
    expect(parseChaptersCsv("chapter,date,title,summary\n3,2026-02-30,X,", []).errors.length).toBe(1);
  });
  it("caps files at 500 rows", () => {
    const body = Array.from({ length: CSV_MAX_ROWS + 1 }, (_, i) => `1,${i + 1},T,,,,,,,,,`).join("\n");
    expect(parseScenesCsv(`chapter,scene_order,title,location,kind,leave_at,start,end,summary,details,experience_card,wardrobe_look\n${body}`, [], [1]).rows).toEqual([]);
  });
  it("splits the wardrobe palette on · into names with empty hex", () => {
    expect(parsePalette("Sand · Olive · Ivory")).toEqual([{ name: "Sand", hex: "" }, { name: "Olive", hex: "" }, { name: "Ivory", hex: "" }]);
    const r = parseWardrobeCsv("chapter,look_order,date_label,look_label,title,description,palette\n2,1,Sat,Look 1,Linen,,Sand · Olive", [], [2]);
    expect(r.rows[0]?.palette).toHaveLength(2);
  });
});
