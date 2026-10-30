import Papa from "papaparse";
import type { SiteRole } from "./locked-areas";

export const TIME_RE = /^(1[0-2]|[1-9]):[0-5][0-9] (AM|PM)$/;
export const SCENE_KINDS = ["core", "flex", "optional"] as const;
export type SceneKind = (typeof SCENE_KINDS)[number];
export const CSV_MAX_ROWS = 500;
export const CSV_MAX_BYTES = 1024 * 1024;

export interface PaletteItem { name: string; hex: string }

export const ALIGNMENTS = ["left", "center", "right"] as const;
export type ScriptAlignment = (typeof ALIGNMENTS)[number];
export function scriptAlignment(value: string | null | undefined): ScriptAlignment | null {
  return value === "left" || value === "center" || value === "right" ? value : null;
}
export interface ScriptFields {
  layout?: ScriptAlignment | null; heading_before?: string | null; heading_before_align?: ScriptAlignment | null;
  transition_after?: string | null; transition_after_align?: ScriptAlignment | null;
}
export interface Chapter extends ScriptFields { number: number; date: string; title: string; summary: string; visible: boolean; sort_order: number }
export interface Scene {
  id?: string; chapter_number: number; scene_order: number; title: string; location: string; kind: SceneKind;
  leave_at: string | null; start_time: string | null; end_time: string | null; summary: string; details: string;
  experience_card: string | null; wardrobe_look: number | null; visible: boolean;
}
export interface WardrobeLook {
  id?: string; chapter_number: number; look_order: number; date_label: string; look_label: string; title: string;
  description: string; palette: PaletteItem[]; photos: string[]; visible: boolean;
}

export function canEditItinerary(roles: readonly SiteRole[]) {
  return roles.some((r) => r === "host" || r === "schedule_manager");
}

/** Which tab the Itinerary should open on, and which chapter. */
export function initialItineraryView(canView: boolean, today: string, chapters: { number: number; date: string }[]) {
  const match = canView ? chapters.find((c) => c.date === today) : undefined;
  return match ? { tab: "scenes" as const, chapter: match.number } : { tab: "script" as const, chapter: chapters[0]?.number ?? 1 };
}

export function parsePalette(cell: string): PaletteItem[] {
  return cell.split("·").map((s) => s.trim()).filter(Boolean).map((name) => ({ name, hex: "" }));
}

export const CSV_COLUMNS = {
  chapters: ["chapter", "date", "title", "summary", "layout", "heading_before", "heading_before_align", "transition_after", "transition_after_align"],
  scenes: ["chapter", "scene_order", "title", "location", "kind", "leave_at", "start", "end", "summary", "details", "experience_card", "wardrobe_look"],
  wardrobe: ["chapter", "look_order", "date_label", "look_label", "title", "description", "palette"],
} as const;
export type CsvKind = keyof typeof CSV_COLUMNS;

export function csvTemplate(kind: CsvKind) {
  return CSV_COLUMNS[kind].join(",") + "\n";
}

export function exportChaptersCsv(chapters: Chapter[]) {
  return Papa.unparse({ fields: [...CSV_COLUMNS.chapters], data: chapters.map((c) => [c.number, c.date, c.title, c.summary, c.layout ?? "left", c.heading_before ?? "", c.heading_before_align ?? "center", c.transition_after ?? "", c.transition_after_align ?? "right"]) });
}

export interface RowError { row: number; message: string }
export interface ImportResult<T> { rows: T[]; errors: RowError[] }

type Raw = Record<string, string>;

function parseRaw(csv: string, kind: CsvKind): { data: Raw[]; errors: RowError[] } {
  const res = Papa.parse<Raw>(csv.replace(/^\uFEFF/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim().toLowerCase() });
  const errors: RowError[] = res.errors.map((e) => ({ row: (e.row ?? 0) + 2, message: e.message }));
  const required = kind === "chapters" ? CSV_COLUMNS.chapters.slice(0, 4) : CSV_COLUMNS[kind];
  const missing = required.filter((c) => !res.meta.fields?.includes(c));
  if (missing.length) errors.push({ row: 1, message: `Missing columns: ${missing.join(", ")}` });
  if (!res.data.length) errors.push({ row: 1, message: "The file has no rows" });
  if (res.data.length > CSV_MAX_ROWS) errors.push({ row: 1, message: `More than ${CSV_MAX_ROWS} rows` });
  return { data: res.data, errors };
}

const cell = (r: Raw, k: string) => (r[k] ?? "").trim();
const isInt = (s: string) => /^\d+$/.test(s);
function validDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
}
function chapterNo(r: Raw, row: number, errors: RowError[]) {
  const c = cell(r, "chapter");
  if (!isInt(c) || +c < 1 || +c > 10) { errors.push({ row, message: "chapter must be a whole number from 1 to 10" }); return null; }
  return +c;
}
function finish<T>(rows: T[], errors: RowError[]): ImportResult<T> {
  return errors.length ? { rows: [], errors } : { rows, errors };
}
function dupCheck(keys: string[], errors: RowError[]) {
  const seen = new Map<string, number>();
  keys.forEach((k, i) => { if (!k) return; if (seen.has(k)) errors.push({ row: i + 2, message: `Same key as row ${seen.get(k)}` }); else seen.set(k, i + 2); });
}

/** Blank cells keep existing values; new rows need their required fields. */
export function parseChaptersCsv(csv: string, existing: Chapter[]): ImportResult<Chapter> {
  const { data, errors } = parseRaw(csv, "chapters");
  if (errors.length) return finish([], errors);
  const out: Chapter[] = [];
  data.forEach((r, i) => {
    const row = i + 2; const n = chapterNo(r, row, errors); if (n === null) return;
    const old = existing.find((c) => c.number === n);
    const date = cell(r, "date"), title = cell(r, "title"), summary = cell(r, "summary");
    if (date && !validDate(date)) errors.push({ row, message: "date must be YYYY-MM-DD" });
    if (!old && (!date || !title)) { errors.push({ row, message: "A new chapter needs a date and title" }); return; }
    const align = (key: "layout" | "heading_before_align" | "transition_after_align", fallback: ScriptAlignment) => {
      const v = cell(r, key);
      if (v && !ALIGNMENTS.includes(v as ScriptAlignment)) errors.push({ row, message: `${key} must be left, center or right` });
      return v ? v as ScriptAlignment : old?.[key] ?? fallback;
    };
    out.push({ number: n, date: date || old?.date || "", title: title || old?.title || "", summary: summary || old?.summary || "", visible: old?.visible ?? true, sort_order: old?.sort_order ?? n,
      layout: align("layout", "left"), heading_before: cell(r, "heading_before") || old?.heading_before || null,
      heading_before_align: align("heading_before_align", "center"), transition_after: cell(r, "transition_after") || old?.transition_after || null,
      transition_after_align: align("transition_after_align", "right"),
    });
  });
  dupCheck(data.map((r) => cell(r, "chapter")), errors);
  return finish(out, errors);
}

export function parseScenesCsv(csv: string, existing: Scene[], chapterNumbers: number[]): ImportResult<Scene> {
  const { data, errors } = parseRaw(csv, "scenes");
  if (errors.length) return finish([], errors);
  const out: Scene[] = [];
  data.forEach((r, i) => {
    const row = i + 2; const n = chapterNo(r, row, errors); if (n === null) return;
    if (!chapterNumbers.includes(n)) errors.push({ row, message: `Chapter ${n} does not exist` });
    const ord = cell(r, "scene_order");
    if (!isInt(ord)) { errors.push({ row, message: "scene_order must be a whole number" }); return; }
    const old = existing.find((s) => s.chapter_number === n && s.scene_order === +ord);
    const kind = cell(r, "kind").toLowerCase();
    if (kind && !SCENE_KINDS.includes(kind as SceneKind)) errors.push({ row, message: "kind must be core, flex or optional" });
    for (const [col, label] of [["leave_at", "leave_at"], ["start", "start"], ["end", "end"]] as const) {
      const v = cell(r, col); if (v && !TIME_RE.test(v)) errors.push({ row, message: `${label} must look like 9:30 AM` });
    }
    const look = cell(r, "wardrobe_look");
    if (look && !isInt(look)) errors.push({ row, message: "wardrobe_look must be a whole number" });
    const title = cell(r, "title");
    if (!old && !title) { errors.push({ row, message: "A new scene needs a title" }); return; }
    const keep = <K extends keyof Scene>(v: string, k: K, fallback: Scene[K]): Scene[K] => (v ? (v as Scene[K]) : old ? old[k] : fallback);
    out.push({
      ...(old?.id ? { id: old.id } : {}),
      chapter_number: n, scene_order: +ord,
      title: title || old!.title,
      location: keep(cell(r, "location"), "location", ""),
      kind: keep(kind, "kind", "core"),
      leave_at: keep(cell(r, "leave_at"), "leave_at", null),
      start_time: keep(cell(r, "start"), "start_time", null),
      end_time: keep(cell(r, "end"), "end_time", null),
      summary: keep(cell(r, "summary"), "summary", ""),
      details: (r["details"] ?? "").trim() ? (r["details"] ?? "").replace(/\r\n/g, "\n").trim() : (old?.details ?? ""),
      experience_card: keep(cell(r, "experience_card"), "experience_card", null),
      wardrobe_look: look ? +look : (old?.wardrobe_look ?? null),
      visible: old?.visible ?? true,
    });
  });
  dupCheck(data.map((r) => `${cell(r, "chapter")}|${cell(r, "scene_order")}`), errors);
  return finish(out, errors);
}

export function parseWardrobeCsv(csv: string, existing: WardrobeLook[], chapterNumbers: number[]): ImportResult<WardrobeLook> {
  const { data, errors } = parseRaw(csv, "wardrobe");
  if (errors.length) return finish([], errors);
  const out: WardrobeLook[] = [];
  data.forEach((r, i) => {
    const row = i + 2; const n = chapterNo(r, row, errors); if (n === null) return;
    if (!chapterNumbers.includes(n)) errors.push({ row, message: `Chapter ${n} does not exist` });
    const ord = cell(r, "look_order");
    if (!isInt(ord)) { errors.push({ row, message: "look_order must be a whole number" }); return; }
    const old = existing.find((l) => l.chapter_number === n && l.look_order === +ord);
    const title = cell(r, "title");
    if (!old && !title) { errors.push({ row, message: "A new look needs a title" }); return; }
    const pick = (v: string, o: string | undefined) => v || o || "";
    const pal = cell(r, "palette");
    out.push({
      ...(old?.id ? { id: old.id } : {}),
      chapter_number: n, look_order: +ord,
      date_label: pick(cell(r, "date_label"), old?.date_label),
      look_label: pick(cell(r, "look_label"), old?.look_label),
      title: title || old!.title,
      description: (r["description"] ?? "").trim() ? (r["description"] ?? "").replace(/\r\n/g, "\n").trim() : (old?.description ?? ""),
      palette: pal ? parsePalette(pal) : (old?.palette ?? []),
      photos: old?.photos ?? [],
      visible: old?.visible ?? true,
    });
  });
  dupCheck(data.map((r) => `${cell(r, "chapter")}|${cell(r, "look_order")}`), errors);
  return finish(out, errors);
}
