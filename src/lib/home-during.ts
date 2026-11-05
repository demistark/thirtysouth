// Pure logic for the During Home ("Your Day"): weather mapping, verse choice,
// reference display and the day's highlights. Tested in src/test/home-during.test.ts.

export interface DailyVerse {
  chapter_number: number;
  text: string;
  reference: string;
}

export type WeatherKind =
  | "clear"
  | "partly"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "showers"
  | "thunderstorm";

/** Open-Meteo WMO weather_code → one of the site's eight fixed conditions. */
export function weatherKind(code: number): WeatherKind {
  if (code === 0 || code === 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "rain";
  if ([80, 81, 82].includes(code)) return "showers";
  if ([95, 96, 99].includes(code)) return "thunderstorm";
  return "cloudy";
}

export const WEATHER_LABELS: Record<WeatherKind, string> = {
  clear: "Clear",
  partly: "Partly cloudy",
  cloudy: "Cloudy",
  fog: "Fog",
  drizzle: "Drizzle",
  rain: "Rain",
  showers: "Showers",
  thunderstorm: "Thunderstorm",
};

/** Celsius → whole-degree Fahrenheit. */
export const toFahrenheit = (celsius: number): number => Math.round((celsius * 9) / 5 + 32);

/** Today's verse: the chapter's row, else the chapter 0 fallback, else hidden. */
export function verseForChapter(verses: DailyVerse[], chapterNumber: number): DailyVerse | null {
  const row = verses.find((v) => v.chapter_number === chapterNumber);
  if (row && row.text.trim()) return row;
  const fallback = verses.find((v) => v.chapter_number === 0);
  return fallback && fallback.text.trim() ? fallback : null;
}

const TRANSLATION_TAG =
  /\s*[,(]?\s*(?:KJV|NKJV|NIV|ESV|NLT|NASB|NASB1995|AMP|AMPC|MSG|BSB|WEB|RSV|NRSV|CEV|GNT|GWT|HCSB|NET|ASV|YLT|DBY|WBT|CSB)\)?\s*$/i;

/** Display a reference as passage only — strip a trailing translation tag. */
export function stripTranslation(reference: string): string {
  return reference.replace(TRANSLATION_TAG, "").trim();
}

export interface HighlightScene {
  scene_order: number;
  title: string;
  home_highlight?: boolean;
}

export const HIGHLIGHT_CAP = 4;

/** Ticked scenes in Script order; when none are ticked, the chapter's first four. */
export function highlightsForChapter(scenes: HighlightScene[]): HighlightScene[] {
  const ordered = [...scenes].sort((a, b) => a.scene_order - b.scene_order);
  const ticked = ordered.filter((s) => s.home_highlight);
  return (ticked.length ? ticked : ordered).slice(0, HIGHLIGHT_CAP);
}

/** A scene may be ticked while fewer than four in its chapter are ticked. */
export function canTickHighlight(chapterScenes: HighlightScene[], scene: HighlightScene): boolean {
  if (scene.home_highlight) return true;
  return chapterScenes.filter((s) => s.home_highlight).length < HIGHLIGHT_CAP;
}

/** "WEDNESDAY, 25 NOVEMBER 2026" for `now` in the given zone. */
export function datelineFor(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")}, ${get("day")} ${get("month")} ${get("year")}`.toUpperCase();
}
