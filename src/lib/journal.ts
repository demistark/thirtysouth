// Pure Journal logic: card looks, phases, counters, grouping. No I/O — fully testable.

export type CardStyle = "note" | "page" | "book" | "polaroid" | "film";
export type NoteTint = "apricot" | "seafoam" | "sand";
export type Phase = "before" | "during" | "after";

export interface CommonsPost {
  id: string;
  author_guest_id: string;
  author_name?: string;
  body: string | null;
  photo_path: string | null;
  photo_w: number | null;
  photo_h: number | null;
  card_style: CardStyle;
  size_pct: number;
  tilt_deg: number;
  tint: NoteTint | null;
  stamp: boolean;
  page_number: number | null;
  frame_no: number | null;
  hidden: boolean;
  created_at: string;
}

export interface HeartCard {
  id: string;
  author_guest_id: string;
  author_name?: string;
  body: string;
  city: string | null;
  photo_path: string | null;
  photo_w: number | null;
  photo_h: number | null;
  pinned: boolean;
  pinned_at: string | null;
  tilt_deg: number;
  hidden: boolean;
  created_at: string;
}

export interface ReflectionEntry {
  id: string;
  guest_id: string;
  entry_date: string; // YYYY-MM-DD, the author's own local date
  body: string;
  updated_at: string;
}

export interface JournalSettings {
  commonsPostsPerDay: number;
  commonsChars: number;
  heartCardsPerPerson: number;
  heartPhotosPerPerson: number;
  heartChars: number;
  counterShowAtPct: number;
  commonsShowHonorary: boolean;
  commonsShowAfar: boolean;
  heartShowHonorary: boolean;
  heartShowAfar: boolean;
  reflectionsOpen: boolean;
  phaseDuringStart: string; // "YYYY-MM-DD HH:mm" in phaseTimezone
  phaseTimezone?: string;
  phaseDuringEnd: string;
  phaseOverride: "auto" | Phase;
}

export const DEFAULT_JOURNAL_SETTINGS: JournalSettings = {
  commonsPostsPerDay: 5,
  commonsChars: 500,
  heartCardsPerPerson: 5,
  heartPhotosPerPerson: 3,
  heartChars: 800,
  counterShowAtPct: 70,
  commonsShowHonorary: true,
  commonsShowAfar: true,
  heartShowHonorary: true,
  heartShowAfar: true,
  reflectionsOpen: true,
  phaseDuringStart: "2026-11-20 00:00",
  phaseDuringEnd: "2026-11-30 23:59",
  phaseOverride: "auto",
};

export function parseJournalSettings(m: Record<string, string>): JournalSettings {
  const num = (k: string, d: number) => {
    const n = Number(m[k]);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  const bool = (k: string, d: boolean) => (m[k] === undefined ? d : m[k] === "true");
  const override = m["phase_override"];
  return {
    commonsPostsPerDay: num("commons_posts_per_day", 5),
    commonsChars: num("commons_chars", 500),
    heartCardsPerPerson: num("heart_cards_per_person", 5),
    heartPhotosPerPerson: num("heart_photos_per_person", 3),
    heartChars: num("heart_chars", 800),
    counterShowAtPct: num("counter_show_at_pct", 70),
    commonsShowHonorary: bool("commons_show_honorary", true),
    commonsShowAfar: bool("commons_show_afar", true),
    heartShowHonorary: bool("heart_show_honorary", true),
    heartShowAfar: bool("heart_show_afar", true),
    reflectionsOpen: bool("reflections_open", true),
    phaseDuringStart: m["phase_during_start"] || "2026-11-20 00:00",
    phaseTimezone: m["phase_timezone"] === "Africa/Johannesburg" ? "Africa/Johannesburg" : "Etc/GMT+5",
    phaseDuringEnd: m["phase_during_end"] || "2026-11-30 23:59",
    phaseOverride: override === "before" || override === "during" || override === "after" ? override : "auto",
  };
}

/* ---------------- phases (America/Detroit settings) ---------------- */

function phaseStamp(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export function phaseFromSettings(now: Date, s: JournalSettings): Phase {
  if (s.phaseOverride !== "auto") return s.phaseOverride;
  const stamp = phaseStamp(now, s.phaseTimezone ?? "Etc/GMT+5");
  if (stamp < s.phaseDuringStart) return "before";
  if (stamp > s.phaseDuringEnd) return "after";
  return "during";
}

/* ---------------- counters and allowances ---------------- */

/** Character counter stays hidden until the text reaches pct% of the limit. */
export function showCounter(length: number, max: number, pct: number): boolean {
  return max > 0 && length * 100 >= pct * max;
}

export type AllowanceState = "hidden" | "remaining" | "limit";

/** Daily/per-person allowance stays hidden until pct% is used; at the limit it blocks. */
export function allowanceState(used: number, limit: number, pct: number): { state: AllowanceState; left: number } {
  const left = Math.max(0, limit - used);
  if (used >= limit) return { state: "limit", left: 0 };
  if (limit > 0 && used * 100 >= pct * limit) return { state: "remaining", left };
  return { state: "hidden", left };
}

/* ---------------- card looks (assigned once at creation) ---------------- */

export interface CommonsLook {
  card_style: CardStyle;
  size_pct: number;
  tilt_deg: number;
  tint: NoteTint | null;
  stamp: boolean;
  page_number: number | null;
  frame_no: number | null;
}

const TINTS: NoteTint[] = ["apricot", "seafoam", "sand"];

function tilt(rand: () => number, max: number): number {
  // About one card in three is straight.
  if (rand() < 1 / 3) return 0;
  const mag = 0.5 + rand() * (max - 0.5);
  return Math.round(mag * 10) / 10 * (rand() < 0.5 ? -1 : 1);
}

function sizePct(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

export function assignCommonsLook(bodyLength: number, hasPhoto: boolean, rand: () => number = Math.random): CommonsLook {
  if (hasPhoto) {
    const style: CardStyle = rand() < 0.5 ? "polaroid" : "film";
    return {
      card_style: style,
      size_pct: sizePct(rand, 72, 100),
      tilt_deg: tilt(rand, 4),
      tint: null,
      stamp: false,
      page_number: null,
      frame_no: 1 + Math.floor(rand() * 36),
    };
  }
  if (bodyLength <= 120) {
    return {
      card_style: "note",
      size_pct: sizePct(rand, 72, 100),
      tilt_deg: tilt(rand, 2.5),
      tint: TINTS[Math.floor(rand() * TINTS.length)]!,
      stamp: false,
      page_number: null,
      frame_no: null,
    };
  }
  if (bodyLength > 200 && rand() < 1 / 6) {
    return {
      card_style: "book",
      size_pct: sizePct(rand, 85, 100),
      tilt_deg: tilt(rand, 2),
      tint: null,
      stamp: false,
      page_number: 100 + Math.floor(rand() * 301),
      frame_no: null,
    };
  }
  return {
    card_style: "page",
    size_pct: sizePct(rand, 85, 100),
    tilt_deg: tilt(rand, 2.5),
    tint: null,
    stamp: rand() < 1 / 3,
    page_number: null,
    frame_no: null,
  };
}

export function heartTilt(rand: () => number = Math.random): number {
  return Math.round((rand() * 2 - 1) * 10) / 10;
}

/* ---------------- Close to Heart type variety (deterministic, from the card id) ---------------- */

export type HeartTone = "ink" | "ember" | "olive";
export interface HeartCardStyle { sizePx: number; weight: 400 | 500 | 600; tone: HeartTone }

/** FNV-1a: stable across loads and devices, so a card always looks the same. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The site — never the guest — picks the look. Size follows message length;
 * colour (~80/10/10 ink/ember/olive) and weight come from independent hashes
 * of the card id so they never correlate. Shared here so the PDF export can reuse it.
 */
export function heartCardStyle(id: string, bodyLength: number): HeartCardStyle {
  const sizePx = bodyLength <= 40 ? 26 : bodyLength <= 90 ? 22 : bodyLength <= 180 ? 18 : 16;
  const hColor = hash32(id) % 10;
  const tone: HeartTone = hColor === 0 ? "ember" : hColor === 1 ? "olive" : "ink";
  const weight = hash32(`${id}#weight`) % 3 === 0 ? (bodyLength <= 40 ? 600 : 500) : 400;
  return { sizePx, weight, tone };
}

/** WCAG contrast ratio between two hex colours. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const sorted = [lum(hexA), lum(hexB)].sort((a, b) => b - a);
  return (sorted[0]! + 0.05) / (sorted[1]! + 0.05);
}

// Card paper is #FFFDF9; tones are existing palette tokens.
export const HEART_TONE_HEX: Record<HeartTone, string> = { ink: "#2D3330", ember: "#9A3A17", olive: "#6F7B4A" };
export const HEART_PAPER_HEX = "#FFFDF9";

/**
 * Resolves a tone to a CSS colour with a contrast fallback: ember-deep passes 4.5:1 at
 * every size; olive (#6F7B4A, ~4.2:1 on the card) passes only as large text (≥24px, 3:1),
 * so smaller olive cards fall back to the dark ink.
 */
export function heartTextColor(tone: HeartTone, sizePx: number): string {
  if (tone === "ember" && contrastRatio(HEART_TONE_HEX.ember, HEART_PAPER_HEX) >= 4.5) return "var(--ember-deep)";
  if (tone === "olive" && sizePx >= 24 && contrastRatio(HEART_TONE_HEX.olive, HEART_PAPER_HEX) >= 3) return "var(--scene-olive)";
  return "var(--ink)";
}

/** Phone widths: tilt is softened and every card is at least 76% of the column. */
export function phoneAdjust(size_pct: number, tilt_deg: number): { size_pct: number; tilt_deg: number } {
  return { size_pct: Math.max(76, size_pct), tilt_deg: Math.round(tilt_deg * 0.6 * 10) / 10 };
}

/* ---------------- board grouping (Cape Town days) ---------------- */

export function capeTownDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function formatBoardDay(day: string): string {
  const [y = 0, m = 1, d = 1] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace(",", "");
}

export function capeTownTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Johannesburg",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

/** Newest day first, newest post first within a day. */
export function groupByDay(posts: CommonsPost[]): { day: string; posts: CommonsPost[] }[] {
  const map = new Map<string, CommonsPost[]>();
  for (const p of posts) {
    const day = capeTownDay(p.created_at);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(p);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, list]) => ({
      day,
      posts: list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    }));
}

/** Pinned cards first (host's picks), then newest first. */
export function orderHeartCards(cards: HeartCard[]): HeartCard[] {
  return [...cards].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.created_at < b.created_at ? 1 : -1;
  });
}

/** Photo aspect follows the photo, clamped between 4:5 and 16:10. */
export function clampAspect(w: number | null, h: number | null): number {
  if (!w || !h) return 3 / 2;
  const ratio = w / h;
  return Math.min(16 / 10, Math.max(4 / 5, ratio));
}

/** The author's own local calendar date (not Cape Town time). */
export function localEntryDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatEntryDate(day: string): string {
  const [y = 0, m = 1, d = 1] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace(",", "");
}
