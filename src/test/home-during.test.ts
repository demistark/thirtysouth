import { describe, expect, it } from "vitest";
import {
  canTickHighlight,
  datelineFor,
  highlightsForChapter,
  stripTranslation,
  toFahrenheit,
  verseForChapter,
  weatherKind,
  WEATHER_LABELS,
  HIGHLIGHT_CAP,
  type DailyVerse,
  type HighlightScene,
} from "@/lib/home-during";

describe("weatherKind", () => {
  it("maps the Open-Meteo codes to the fixed conditions", () => {
    expect(weatherKind(0)).toBe("clear");
    expect(weatherKind(1)).toBe("clear");
    expect(weatherKind(2)).toBe("partly");
    expect(weatherKind(3)).toBe("cloudy");
    expect(weatherKind(45)).toBe("fog");
    expect(weatherKind(48)).toBe("fog");
    expect(weatherKind(51)).toBe("drizzle");
    expect(weatherKind(57)).toBe("drizzle");
    expect(weatherKind(61)).toBe("rain");
    expect(weatherKind(67)).toBe("rain");
    expect(weatherKind(80)).toBe("showers");
    expect(weatherKind(82)).toBe("showers");
    expect(weatherKind(95)).toBe("thunderstorm");
    expect(weatherKind(99)).toBe("thunderstorm");
  });
  it("has a label for every kind and a safe default", () => {
    expect(weatherKind(999)).toBe("cloudy");
    for (const kind of ["clear", "partly", "cloudy", "fog", "drizzle", "rain", "showers", "thunderstorm"] as const) {
      expect(WEATHER_LABELS[kind]).toBeTruthy();
    }
  });
});

describe("toFahrenheit", () => {
  it("converts and rounds to whole degrees", () => {
    expect(toFahrenheit(21)).toBe(70);
    expect(toFahrenheit(0)).toBe(32);
    expect(toFahrenheit(21.4)).toBe(71);
    expect(toFahrenheit(-3.6)).toBe(26);
  });
});

describe("verseForChapter", () => {
  const verses: DailyVerse[] = [
    { chapter_number: 0, text: "Be still, and know that I am God.", reference: "Psalm 46:10" },
    { chapter_number: 1, text: "For I know the thoughts…", reference: "Jeremiah 29:11" },
    { chapter_number: 6, text: "The LORD shall preserve…", reference: "Psalm 121:8" },
  ];
  it("uses the chapter's own row when it has text", () => {
    expect(verseForChapter(verses, 6)?.reference).toBe("Psalm 121:8");
  });
  it("falls back to chapter 0 when the chapter row is missing or empty", () => {
    expect(verseForChapter(verses, 3)?.reference).toBe("Psalm 46:10");
    expect(verseForChapter([...verses, { chapter_number: 4, text: "  ", reference: "John 3:16" }], 4)?.reference).toBe("Psalm 46:10");
  });
  it("is hidden when both the chapter and the fallback are empty", () => {
    expect(verseForChapter([], 2)).toBeNull();
    expect(verseForChapter([{ chapter_number: 0, text: "", reference: "Psalm 46:10" }], 2)).toBeNull();
  });
});

describe("stripTranslation", () => {
  it("removes a trailing translation tag", () => {
    expect(stripTranslation("Psalm 121:8 KJV")).toBe("Psalm 121:8");
    expect(stripTranslation("Jeremiah 29:11 (NIV)")).toBe("Jeremiah 29:11");
    expect(stripTranslation("John 3:16, ESV")).toBe("John 3:16");
  });
  it("leaves a bare passage untouched", () => {
    expect(stripTranslation("Psalm 46:10")).toBe("Psalm 46:10");
  });
});

describe("highlightsForChapter", () => {
  const scenes: HighlightScene[] = [
    { scene_order: 3, title: "C", home_highlight: true },
    { scene_order: 1, title: "A" },
    { scene_order: 2, title: "B", home_highlight: true },
    { scene_order: 4, title: "D" },
    { scene_order: 5, title: "E", home_highlight: true },
  ];
  it("shows ticked scenes in the Script's order", () => {
    expect(highlightsForChapter(scenes).map((s) => s.title)).toEqual(["B", "C", "E"]);
  });
  it("falls back to the first four scenes when none are ticked", () => {
    const plain = scenes.map(({ home_highlight: _h, ...s }) => s);
    expect(highlightsForChapter(plain).map((s) => s.title)).toEqual(["A", "B", "C", "D"]);
  });
  it("caps the list at four", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ scene_order: i + 1, title: `S${i + 1}`, home_highlight: true }));
    expect(highlightsForChapter(six)).toHaveLength(HIGHLIGHT_CAP);
  });
  it("allows ticking only while fewer than four are ticked", () => {
    const four = Array.from({ length: 4 }, (_, i) => ({ scene_order: i + 1, title: `S${i + 1}`, home_highlight: true }));
    const fifth = { scene_order: 5, title: "S5" };
    expect(canTickHighlight([...four, fifth], fifth)).toBe(false);
    expect(canTickHighlight([...four, fifth], four[0]!)).toBe(true); // unticking stays possible
    expect(canTickHighlight([four[0]!, fifth], fifth)).toBe(true);
  });
});

describe("datelineFor", () => {
  it("puts the weekday first, in Cape Town time, uppercased", () => {
    const now = new Date("2026-11-25T06:00:00Z");
    expect(datelineFor(now, "Africa/Johannesburg")).toBe("WEDNESDAY, 25 NOVEMBER 2026");
  });
});
